// SSE-enabled topic analysis with real processing and progress streaming
import { createClient } from '@supabase/supabase-js';
import { analyzeTopicWithLLM, generateTopicSummary, storeTopicInsights } from '../unified-topic-analysis/route';

interface TopicData {
  name: string;
  value: number;
}

interface TopicInsight {
  topic: string;
  summary: string;
  snippets: Array<{
    text: string;
    chunk_id: string;
    relevance: number;
    source?: string;
  }>;
  recommendations: string[];
  total_mentions: number;
}

// Helper function to send SSE message
function sendSSE(controller: ReadableStreamDefaultController, data: {
  type: 'progress' | 'complete' | 'error' | 'keepalive';
  message: string;
  progress?: number;
  data?: {
    chartData: Array<{name: string, value: number}>;
    insights: Array<{
      topic: string;
      summary: string;
      snippets: Array<{text: string, chunk_id: string, relevance: number}>;
      recommendations: string[];
      total_mentions: number;
    }>;
  };
}) {
  try {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(new TextEncoder().encode(message));
  } catch (error) {
    console.error('Error sending SSE message:', error);
  }
}

// Real streaming analysis with actual processing
async function processWithRealStreaming(sseController: ReadableStreamDefaultController) {
  try {
    // Send initial progress
    sendSSE(sseController, {
      type: 'progress',
      message: 'Starting topic analysis...',
      progress: 0
    });

    // Environment checks
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      sendSSE(sseController, {
        type: 'error',
        message: 'Database not configured. Please check environment variables.',
      });
      return;
    }

    if (!process.env.CLAUDE_API_KEY) {
      sendSSE(sseController, {
        type: 'error',
        message: 'Claude API key not configured. Please check environment variables.',
      });
      return;
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    sendSSE(sseController, {
      type: 'progress',
      message: 'Connecting to database...',
      progress: 10
    });

    // Fetch customer data chunks
    const { data: chunks, error } = await supabase
      .from('file_chunks')
      .select(`
        content, 
        created_at, 
        id,
        uploaded_files!inner(name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Failed to fetch chunks from Supabase:', error);
      sendSSE(sseController, {
        type: 'error',
        message: `Database error: ${error.message}`,
      });
      return;
    }

    if (!chunks || chunks.length === 0) {
      console.log('No chunks found');
      sendSSE(sseController, {
        type: 'error',
        message: 'No customer feedback data found. Please upload data first.',
      });
      return;
    }

    console.log(`Found ${chunks.length} chunks for topic analysis`);
    sendSSE(sseController, {
      type: 'progress',
      message: `Found ${chunks.length} chunks of customer feedback`,
      progress: 20
    });

    const topics = ['Pain Points', 'Blockers', 'Customer Requests', 'Solution Feedback'];
    const topicResults = new Map<string, {
      totalScore: number;
      snippets: Array<{text: string, chunk_id: string, relevance: number, source?: string}>;
      recommendations: Set<string>;
      mentionCount: number;
    }>();

    // Initialize topic results
    for (const topic of topics) {
      topicResults.set(topic, {
        totalScore: 0,
        snippets: [],
        recommendations: new Set(),
        mentionCount: 0
      });
    }

    // Process chunks - optimized for streaming mode with timeout considerations
    const maxChunks = 20; // Reduced to prevent timeouts
    const chunksToProcess = chunks.slice(0, maxChunks);
    const validChunks = chunksToProcess.filter(chunk => chunk.content && chunk.content.length >= 50);
    
    console.log(`Starting topic-specific LLM analysis for ${validChunks.length} chunks (limited from ${chunks.length} total)...`);
    
    sendSSE(sseController, {
      type: 'progress',
      message: `Processing ${validChunks.length} valid chunks across 4 topics...`,
      progress: 30
    });
    
    // Process chunks in parallel batches for better performance and timeout management
    const batchSize = 3; // Smaller batches to prevent timeouts and connection issues
    const totalBatches = Math.ceil(validChunks.length / batchSize);
    let processedChunks = 0;

    for (let i = 0; i < validChunks.length; i += batchSize) {
      const batch = validChunks.slice(i, i + batchSize);
      const currentBatch = Math.floor(i / batchSize) + 1;
      const pendingBatches = totalBatches - currentBatch;
      
      sendSSE(sseController, {
        type: 'progress',
        message: `Processing batch ${currentBatch}/${totalBatches} (${batch.length} chunks) - ${pendingBatches} batches pending`,
        progress: 30 + (processedChunks / validChunks.length) * 60
      });

      try {
        // Process all topics for all chunks in this batch in parallel
        const batchPromises = batch.flatMap(chunk => {
          // Extract source information from chunk content
          let sourceName = '';
          try {
            // Try multiple patterns to extract person names from content
            const content = chunk.content || '';
            
            // Pattern 1: "Name: John Doe" or "From: John Doe" 
            let nameMatch = content.match(/(?:name|from|by|customer|user|participant|interviewee):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
            if (nameMatch) {
              sourceName = nameMatch[1].trim();
            } else {
              // Pattern 2: "John Doe said" or "John Doe mentioned"
              nameMatch = content.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+(?:said|mentioned|noted|commented|reported|stated|explained))/i);
              if (nameMatch) {
                sourceName = nameMatch[1].trim();
              } else {
                // Pattern 3: Email signatures like "Best regards, John Doe"
                nameMatch = content.match(/(?:regards|thanks|sincerely|best),?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
                if (nameMatch) {
                  sourceName = nameMatch[1].trim();
                } else {
                  // Pattern 4: Quote attribution "..." - John Doe
                  nameMatch = content.match(/["""].*?["""][\s\-–—]*([A-Z][a-z]+\s+[A-Z][a-z]+)/);
                  if (nameMatch) {
                    sourceName = nameMatch[1].trim();
                  } else {
                    // Pattern 5: First line might contain name if it's structured feedback
                    const firstLine = content.split('\n')[0];
                    nameMatch = firstLine.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s|$|:|-)/);
                    if (nameMatch) {
                      sourceName = nameMatch[1].trim();
                    }
                  }
                }
              }
            }
          } catch {
            // Ignore parsing errors
          }
          
          return topics.map(async (topic) => {
            try {
              const analysis = await analyzeTopicWithLLM(chunk.content, chunk.id, topic, sourceName);
              return { topic, analysis, success: true, sourceName };
            } catch (error) {
              console.error(`Error processing ${topic} for chunk ${chunk.id}:`, error);
              return { topic, analysis: { relevance_score: 0, snippets: [], recommendations: [] }, success: false, sourceName };
            }
          });
        });

        // Wait for batch completion with better error handling
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Aggregate results and handle failures
        let successCount = 0;
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value.analysis.relevance_score > 0) {
            const { topic, analysis, sourceName } = result.value;
            const topicResult = topicResults.get(topic)!;
            topicResult.totalScore += analysis.relevance_score;
            
            // Add source information to snippets
            const snippetsWithSource = analysis.snippets.map((snippet: {text: string, chunk_id: string, relevance: number}) => ({
              ...snippet,
              source: sourceName || undefined
            }));
            topicResult.snippets.push(...snippetsWithSource);
            topicResult.mentionCount += 1;
            
            // Add unique recommendations
            analysis.recommendations.forEach((rec: string) => topicResult.recommendations.add(rec));
            successCount++;
          } else if (result.status === 'rejected') {
            console.error('Batch promise rejected:', result.reason);
          }
        }
        
        // Send progress update
        sendSSE(sseController, {
          type: 'progress',
          message: `Batch ${currentBatch} completed: ${successCount}/${batchPromises.length} analyses successful`,
          progress: 30 + (processedChunks / validChunks.length) * 60
        });
        
        processedChunks += batch.length;
        
        // Minimal delay between batches and send keepalive
        if (i + batchSize < validChunks.length) {
          sendSSE(sseController, {
            type: 'keepalive',
            message: `Batch ${currentBatch} completed. Preparing next batch...`,
            progress: 30 + (processedChunks / validChunks.length) * 60
          });
          await new Promise(resolve => setTimeout(resolve, 100)); // Reduced delay
        }
        
      } catch (error) {
        console.error(`Error processing batch ${currentBatch}:`, error);
        // Continue with next batch on error
      }
    }

    // Build response data
    const chartData: TopicData[] = [];
    const insights: TopicInsight[] = [];

    for (const topic of topics) {
      const result = topicResults.get(topic)!;
      
      // Filter for high-relevance snippets first
      const highRelevanceSnippets = result.snippets
        .filter(snippet => snippet.relevance >= 4) // Only include high to excellent relevance quotes (4-5)
        .sort((a, b) => b.relevance - a.relevance);

      // Only include topics that have high-relevance snippets
      if (highRelevanceSnippets.length > 0) {
        // Chart data uses high-relevance snippet count for consistency with UI display
        chartData.push({
          name: topic,
          value: highRelevanceSnippets.length
        });

        insights.push({
          topic,
          summary: generateTopicSummary(topic, highRelevanceSnippets.length),
          snippets: highRelevanceSnippets, // Include only high-relevance snippets
          recommendations: Array.from(result.recommendations).slice(0, 3), // Top 3 unique recommendations
          total_mentions: highRelevanceSnippets.length
        });
      }
    }

    // Sort results by snippet count (most mentioned first)
    chartData.sort((a, b) => b.value - a.value);
    insights.sort((a, b) => b.snippets.length - a.snippets.length);

    // Store insights in Supabase for historical tracking
    if (insights.length > 0) {
      sendSSE(sseController, {
        type: 'progress',
        message: 'Storing insights in database...',
        progress: 95
      });
      
      await storeTopicInsights(insights);
      
      // Trigger evaluation of new insights by sending a signal
      // This will be picked up by the background worker on its next cycle
      console.log('✨ New insights stored, background evaluations will process them within 2 minutes');
    }

    console.log(`Generated topic analysis: ${chartData.length} topics, ${insights.length} detailed insights`);
    
    // Send completion
    sendSSE(sseController, {
      type: 'complete',
      message: `Analysis complete! Found ${chartData.length} topics with insights.`,
      progress: 100,
      data: {
        chartData,
        insights
      }
    });

  } catch (error) {
    console.error('Error in streaming analysis:', error);
    sendSSE(sseController, {
      type: 'error',
      message: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

export async function GET() {
  console.log('Topic analysis progress API called with SSE streaming');
  
  try {
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    const stream = new ReadableStream({
      start(controller) {
        let isClosed = false;
        
        // Safe enqueue function
        const safeEnqueue = (data: string) => {
          if (!isClosed) {
            try {
              controller.enqueue(new TextEncoder().encode(data));
            } catch (error) {
              console.error('Error enqueueing SSE data:', error);
              isClosed = true;
            }
          }
        };
        
        // Send initial connection message
        const initialMessage = `data: ${JSON.stringify({
          type: 'progress',
          message: 'Connection established, initializing analysis...',
          progress: 0
        })}\n\n`;
        safeEnqueue(initialMessage);
        
        // Send periodic keepalive messages more frequently
        const keepaliveInterval = setInterval(() => {
          if (!isClosed) {
            safeEnqueue(`data: ${JSON.stringify({
              type: 'keepalive',
              message: 'Connection active...',
            })}\n\n`);
          } else {
            clearInterval(keepaliveInterval);
          }
        }, 5000); // Every 5 seconds to prevent timeouts
        
        // Start the real streaming analysis
        processWithRealStreaming(controller)
          .catch((error: unknown) => {
            console.error('Error in streaming analysis:', error);
            if (!isClosed) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred during analysis';
              const errorMessage = `data: ${JSON.stringify({
                type: 'error',
                message: `Analysis failed: ${errorMsg}`,
              })}\n\n`;
              safeEnqueue(errorMessage);
            }
          })
          .finally(() => {
            clearInterval(keepaliveInterval);
            if (!isClosed) {
              try {
                controller.close();
              } catch (closeError) {
                console.error('Error closing SSE controller:', closeError);
              }
            }
            isClosed = true;
          });
      },
      cancel() {
        console.log('SSE connection cancelled by client');
      }
    });

    return new Response(stream, { headers });
    
  } catch (error) {
    console.error('Error setting up SSE stream:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to initialize streaming connection' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}