import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ChatAnthropic } from '@langchain/anthropic';

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

interface UnifiedTopicResponse {
  chartData: TopicData[];
  insights: TopicInsight[];
}

interface LLMInsightInsert {
  file_id: number | null;
  user_id: string | null;
  insight_type: string;
  content: string;
  metadata: Record<string, unknown>;
}

// Topic-specific prompts for more targeted analysis
const topicPrompts = {
  'Pain Points': `Analyze the following customer feedback specifically for EMOTIONAL PAIN POINTS - frustrations, stress, confusion, dissatisfaction, and negative experiences that affect user satisfaction and sentiment. Focus on feelings and experiences, not implementation barriers.

CUSTOMER FEEDBACK:
"{content}"

EMOTIONAL PAIN POINT CRITERIA:
- User frustration and stress (feeling overwhelmed, confused, annoyed)
- Experience quality issues (poor usability, confusing interfaces, time-consuming processes)
- Satisfaction problems (unmet expectations, disappointing outcomes, quality concerns)
- Emotional reactions (anger, disappointment, confusion, feeling stuck)

EXCLUDE technical implementation blockers - focus on how customers FEEL about their experience.

TASKS:
1. Identify emotional pain points and experience quality issues (score 1-5, where 5 = severe emotional frustration clearly expressed, 1 = minor dissatisfaction)
2. If score >= 4, extract 1-2 quotes that show customer frustration, confusion, or negative sentiment
3. Generate 2-3 experience-focused recommendations to improve satisfaction and reduce frustration

RESPONSE FORMAT (JSON only):
{
  "relevance_score": number,
  "snippets": [{"text": "quote expressing frustration or negative experience", "relevance": number}],
  "recommendations": ["specific recommendation to improve user experience and satisfaction"]
}

If no emotional pain points exist, return: {"relevance_score": 0, "snippets": [], "recommendations": []}`,

  'Blockers': `Analyze the following customer feedback specifically for IMPLEMENTATION BLOCKERS - concrete obstacles that prevent customers from completing specific tasks, achieving their goals, or implementing solutions. Focus ONLY on actionable blockers, not general frustrations.

CUSTOMER FEEDBACK:
"{content}"

IMPLEMENTATION BLOCKER CRITERIA:
- Technical barriers preventing task completion (APIs not working, integrations failing, system limitations)
- Process obstacles stopping workflow progression (missing permissions, broken workflows, dependency issues) 
- Resource constraints blocking implementation (missing tools, insufficient access, capability gaps)
- System limitations preventing goal achievement (performance bottlenecks, compatibility issues, feature gaps that block specific use cases)

EXCLUDE general complaints, wishes, or pain points that don't prevent specific goal completion.

TASKS:
1. Identify if this feedback contains specific IMPLEMENTATION BLOCKERS (score 1-5, where 5 = critical blocker preventing goal completion, 1 = minor implementation obstacle)
2. If score >= 4, extract 1-2 most specific quotes that describe what the customer CANNOT DO or CANNOT COMPLETE
3. Generate 2-3 precise, technical recommendations to remove these implementation barriers

RESPONSE FORMAT (JSON only):
{
  "relevance_score": number,
  "snippets": [{"text": "quote showing what customer cannot complete/implement", "relevance": number}],
  "recommendations": ["specific technical solution to remove implementation barrier"]
}

If no implementation blockers exist, return: {"relevance_score": 0, "snippets": [], "recommendations": []}`,

  'Customer Requests': `Analyze the following customer feedback specifically for EXPLICIT PRODUCT/SERVICE REQUESTS - concrete asks for new features, enhancements, services, or program improvements. Focus ONLY on specific, actionable requests.

CUSTOMER FEEDBACK:
"{content}"

SPECIFIC REQUEST CRITERIA:
- NEW FEATURE REQUESTS: "Please add X feature", "We need Y functionality", "Can you build Z capability"
- FEATURE ENHANCEMENTS: "Improve X by adding Y", "Make Z feature work better", "Upgrade A to include B"
- SERVICE REQUESTS: "Provide X service", "Offer Y support", "Add Z customer service option"
- PROGRAM IMPROVEMENTS: "Add X to the program", "Include Y in the package", "Extend Z offering"
- INTEGRATION REQUESTS: "Connect with X platform", "Add Y integration", "Support Z system"

EXCLUDE: General suggestions, complaints, vague wishes, or conceptual ideas without specific implementation requests.

TASKS:
1. Identify explicit product/service requests (score 1-5, where 5 = specific feature/service request with clear ask, 1 = vague suggestion)
2. If score >= 4, extract 1-2 quotes with the most specific asks (must contain clear "add", "provide", "build", "include" language)
3. Generate 2-3 concrete development/implementation recommendations for the requested features/services

RESPONSE FORMAT (JSON only):
{
  "relevance_score": number,
  "snippets": [{"text": "quote with specific feature/service request", "relevance": number}],
  "recommendations": ["specific implementation plan for requested feature/service"]
}

If no explicit requests exist, return: {"relevance_score": 0, "snippets": [], "recommendations": []}`,

  'Solution Feedback': `Analyze the following customer feedback specifically for SOLUTION FEEDBACK - feedback on existing solutions, how well current features work, user experience with current offerings.

CUSTOMER FEEDBACK:
"{content}"

TASKS:
1. Determine if this feedback contains genuine solution feedback (score 1-5, where 5 = detailed experience with current solution, 1 = brief mention)
2. If score >= 4, extract 1-2 most insightful quotes about the solution experience
3. Generate 2-3 specific, actionable recommendations to improve the solution based on this feedback

RESPONSE FORMAT (JSON only):
{
  "relevance_score": number,
  "snippets": [{"text": "quote", "relevance": number}],
  "recommendations": ["specific actionable recommendation"]
}

If no solution feedback exists, return: {"relevance_score": 0, "snippets": [], "recommendations": []}`
};

async function analyzeTopicWithLLM(content: string, chunkId: string, topic: string, sourceName?: string): Promise<{
  relevance_score: number;
  snippets: Array<{text: string, chunk_id: string, relevance: number, source?: string}>;
  recommendations: string[];
}> {
  if (!process.env.CLAUDE_API_KEY) {
    console.log('Claude API key not found, skipping LLM analysis');
    return { relevance_score: 0, snippets: [], recommendations: [] };
  }

  try {
    const model = new ChatAnthropic({
      apiKey: process.env.CLAUDE_API_KEY,
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.1
    });

    const prompt = topicPrompts[topic as keyof typeof topicPrompts];
    if (!prompt) {
      return { relevance_score: 0, snippets: [], recommendations: [] };
    }

    // Add timeout to LLM call to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('LLM call timeout')), 30000) // 30 second timeout per call
    );
    
    const response = await Promise.race([
      model.invoke([{ 
        role: 'user', 
        content: prompt.replace('{content}', content) 
      }]),
      timeoutPromise
    ]);
    
    const responseText = (response as { content: { toString(): string } }).content.toString().trim();
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // Transform snippets to include chunk_id and source
      const transformedSnippets = (result.snippets || []).map((snippet: {text: string, relevance?: number}) => ({
        text: snippet.text,
        chunk_id: chunkId,
        relevance: snippet.relevance || 3,
        source: sourceName || undefined
      }));
      
      return {
        relevance_score: result.relevance_score || 0,
        snippets: transformedSnippets,
        recommendations: result.recommendations || []
      };
    } else {
      console.log('Could not parse LLM response for topic:', topic);
      return { relevance_score: 0, snippets: [], recommendations: [] };
    }
    
  } catch (error) {
    console.error(`Error in LLM analysis for topic ${topic}:`, error);
    return { relevance_score: 0, snippets: [], recommendations: [] };
  }
}

function generateTopicSummary(topic: string, totalMentions: number): string {
  const templates = {
    'Pain Points': 'Customer pain point analysis reveals',
    'Blockers': 'Implementation blocker feedback shows', 
    'Customer Requests': 'Feature request analysis indicates',
    'Solution Feedback': 'Solution effectiveness feedback demonstrates'
  };
  
  const template = templates[topic as keyof typeof templates] || 'Customer feedback shows';
  
  if (totalMentions === 0) return `${template} no specific feedback in this category.`;
  if (totalMentions === 1) return `${template} focused feedback around this theme.`;
  if (totalMentions <= 3) return `${template} some key insights in this area.`;
  return `${template} significant discussion across ${totalMentions} customer touchpoints.`;
}

// Store insights in Supabase with proper categorization
async function storeTopicInsights(insights: TopicInsight[]): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('Supabase not configured, skipping insight storage');
    return;
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const insightRows: LLMInsightInsert[] = [];
    
    for (const insight of insights) {
      const topicType = insight.topic.toLowerCase().replace(' ', '_');
      
      // Store each recommendation as a separate insight
      for (const recommendation of insight.recommendations) {
        insightRows.push({
          file_id: null,
          user_id: null,
          insight_type: `${topicType}_recommendation`,
          content: recommendation,
          metadata: {
            topic: insight.topic,
            total_mentions: insight.total_mentions,
            summary: insight.summary
          }
        });
      }
      
      // Store each snippet as a key quote (already filtered for relevance >= 4)
      for (const snippet of insight.snippets) {
        insightRows.push({
          file_id: null,
          user_id: null,
          insight_type: `${topicType}_quote`,
          content: snippet.text,
          metadata: {
            topic: insight.topic,
            chunk_id: snippet.chunk_id,
            relevance: snippet.relevance
          }
        });
      }
      
      // Store the summary as a highlight
      insightRows.push({
        file_id: null,
        user_id: null,
        insight_type: `${topicType}_summary`,
        content: insight.summary,
        metadata: {
          topic: insight.topic,
          total_mentions: insight.total_mentions,
          snippet_count: insight.snippets.length
        }
      });
    }
    
    if (insightRows.length > 0) {
      await supabase.from('llm_insights').insert(insightRows);
      console.log(`Stored ${insightRows.length} topic insights in database`);
    }
    
  } catch (error) {
    console.error('Failed to store topic insights:', error);
  }
}

// Mock data for fallback
const mockResponse: UnifiedTopicResponse & { isDemo?: boolean } = {
  isDemo: true,
  chartData: [
    { name: 'Pain Points', value: 12 },
    { name: 'Customer Requests', value: 8 },
    { name: 'Solution Feedback', value: 5 },
    { name: 'Blockers', value: 3 }
  ],
  insights: [
    {
      topic: 'Pain Points',
      summary: 'Customer pain point analysis reveals significant discussion across 12 customer touchpoints.',
      snippets: [
        { text: 'The system is slow and often times out during peak hours', chunk_id: 'mock-1', relevance: 5, source: 'Sarah Johnson' },
        { text: 'I struggle with the confusing navigation and cant find basic features', chunk_id: 'mock-2', relevance: 4, source: 'Mike Chen' },
        { text: 'Minor issue with loading', chunk_id: 'mock-low', relevance: 2, source: 'Test User' } // This should be filtered out
      ].filter(snippet => snippet.relevance >= 4), // Apply the same filtering logic
      recommendations: [
        'Optimize server performance and implement load balancing for peak hour traffic',
        'Redesign navigation with user-centric information architecture and usability testing'
      ],
      total_mentions: 12
    },
    {
      topic: 'Customer Requests',
      summary: 'Feature request analysis indicates focused feedback around automation capabilities.',
      snippets: [
        { text: 'Please add batch processing so I can handle multiple files at once', chunk_id: 'mock-3', relevance: 5, source: 'David Kim' },
        { text: 'Integration with Slack would make our workflow so much smoother', chunk_id: 'mock-4', relevance: 4, source: 'Rachel Green' },
        { text: 'Maybe consider adding some features', chunk_id: 'mock-low2', relevance: 1, source: 'Low Relevance User' } // This should be filtered out
      ].filter(snippet => snippet.relevance >= 4), // Apply the same filtering logic
      recommendations: [
        'Develop batch processing functionality for file uploads and operations',
        'Build Slack integration for workflow notifications and team collaboration'
      ],
      total_mentions: 8
    }
  ]
};

// Export core analysis functions for use by progress route
export { analyzeTopicWithLLM, generateTopicSummary, storeTopicInsights };

export async function processTopicAnalysis() {
  console.log('Unified topic analysis API called');
  
  try {
    console.log('Environment check: Supabase URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Environment check: Supabase Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    console.log('Environment check: Claude API Key exists:', !!process.env.CLAUDE_API_KEY);
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.log('Supabase not configured, using mock data');
      return NextResponse.json(mockResponse);
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Fetch customer data chunks
    const { data: chunks, error } = await supabase
      .from('file_chunks')
      .select('content, created_at, id')
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Failed to fetch chunks from Supabase:', error);
      return NextResponse.json(mockResponse);
    }

    if (!chunks || chunks.length === 0) {
      console.log('No chunks found, using mock data');
      return NextResponse.json(mockResponse);
    }

    console.log(`Found ${chunks.length} chunks for unified topic analysis`);
    
    // Check if we have existing insights in the database
    const { data: existingInsights, error: insightsError } = await supabase
      .from('llm_insights')
      .select('insight_type, content, metadata')
      .in('insight_type', [
        'pain_points_recommendation', 'pain_points_quote', 'pain_points_summary',
        'blockers_recommendation', 'blockers_quote', 'blockers_summary',
        'customer_requests_recommendation', 'customer_requests_quote', 'customer_requests_summary',
        'solution_feedback_recommendation', 'solution_feedback_quote', 'solution_feedback_summary'
      ]);

    if (!insightsError && existingInsights && existingInsights.length > 0) {
      console.log(`Found ${existingInsights.length} existing insights in database, building response from real data`);
      
      // Build topic analysis from existing insights
      const topics = ['Pain Points', 'Blockers', 'Customer Requests', 'Solution Feedback'];
      const chartData: TopicData[] = [];
      const insights: TopicInsight[] = [];
      
      for (const topic of topics) {
        const topicKey = topic.toLowerCase().replace(' ', '_');
        const topicInsights = existingInsights.filter(insight => 
          insight.insight_type.startsWith(topicKey)
        );
        
        if (topicInsights.length > 0) {
          // Build insight object
          const recommendations = topicInsights
            .filter(insight => insight.insight_type.endsWith('_recommendation'))
            .map(insight => insight.content)
            .slice(0, 3); // Top 3 recommendations
            
          const snippets = topicInsights
            .filter(insight => insight.insight_type.endsWith('_quote'))
            .map(insight => {
              const metadata = insight.metadata as Record<string, unknown>;
              return {
                text: insight.content,
                chunk_id: (metadata?.chunk_id as string) || 'unknown',
                relevance: (metadata?.relevance as number) || 3
              };
            })
            .sort((a, b) => b.relevance - a.relevance); // Sort by relevance, include all snippets
            
          // Use actual snippet count for consistency
          const totalMentions = snippets.length;
          
          chartData.push({
            name: topic,
            value: totalMentions
          });
            
          const summaryInsight = topicInsights.find(insight => 
            insight.insight_type.endsWith('_summary')
          );
          
          const summary = summaryInsight?.content || 
            generateTopicSummary(topic, totalMentions);
          
          insights.push({
            topic,
            summary,
            snippets,
            recommendations,
            total_mentions: totalMentions
          });
        }
      }
      
      // Sort results by mentions
      chartData.sort((a, b) => b.value - a.value);
      insights.sort((a, b) => b.snippets.length - a.snippets.length);
      
      console.log(`Built response from existing insights: ${chartData.length} topics, ${insights.length} detailed insights`);
      return NextResponse.json({
        chartData,
        insights,
        isDemo: false,
        source: 'database_insights'
      });
    }
    
    // If there are many chunks and no existing insights, return mock data and suggest background processing
    if (chunks.length > 30) {
      console.log(`Large dataset (${chunks.length} chunks) detected. No existing insights found. Returning mock data for immediate response. Use 'Generate Summary' button for full analysis.`);
      return NextResponse.json(mockResponse);
    }

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

    // Process chunks with reasonable limit
    const maxChunks = 20;
    const chunksToProcess = chunks.slice(0, maxChunks);
    const validChunks = chunksToProcess.filter(chunk => chunk.content && chunk.content.length >= 50);
    
    console.log(`Starting topic-specific LLM analysis for ${validChunks.length} chunks (limited from ${chunks.length} total)...`);
    
    // Process chunks in parallel batches for better performance
    const batchSize = 3;
    const totalBatches = Math.ceil(validChunks.length / batchSize);

    for (let i = 0; i < validChunks.length; i += batchSize) {
      const batch = validChunks.slice(i, i + batchSize);
      const currentBatch = Math.floor(i / batchSize) + 1;
      
      console.log(`Processing batch ${currentBatch}/${totalBatches} (${batch.length} chunks)...`);

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
              return { topic, analysis, success: true };
            } catch (error) {
              console.error(`Error processing ${topic} for chunk ${chunk.id}:`, error);
              return { topic, analysis: { relevance_score: 0, snippets: [], recommendations: [] }, success: false };
            }
          });
        });

        // Wait for batch completion with better error handling
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Aggregate results and handle failures
        let successCount = 0;
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value.analysis.relevance_score > 0) {
            const { topic, analysis } = result.value;
            const topicResult = topicResults.get(topic)!;
            topicResult.totalScore += analysis.relevance_score;
            topicResult.snippets.push(...analysis.snippets);
            topicResult.mentionCount += 1;
            
            // Add unique recommendations
            analysis.recommendations.forEach((rec: string) => topicResult.recommendations.add(rec));
            successCount++;
          } else if (result.status === 'rejected') {
            console.error('Batch promise rejected:', result.reason);
          }
        }
        
        console.log(`Batch ${currentBatch} completed: ${successCount}/${batchPromises.length} analyses successful`);
        
        // Small delay between batches
        if (i + batchSize < validChunks.length) {
          console.log(`Batch ${currentBatch} completed. Preparing next batch...`);
          await new Promise(resolve => setTimeout(resolve, 100));
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

    // If no results were found, return mock data instead of empty results
    if (chartData.length === 0 && insights.length === 0) {
      console.log('No topic insights generated from real data, falling back to mock data');
      return NextResponse.json(mockResponse);
    }

    // Sort results by mention count (most discussed first)
    chartData.sort((a, b) => b.value - a.value);
    insights.sort((a, b) => b.snippets.length - a.snippets.length);

    // Store insights in Supabase for historical tracking
    if (insights.length > 0) {
      console.log('Storing insights in database...');
      await storeTopicInsights(insights);
    }

    console.log(`Generated unified topic analysis: ${chartData.length} topics, ${insights.length} detailed insights`);
    
    return NextResponse.json({
      chartData,
      insights,
      isDemo: false,
      source: 'processed_chunks'
    });
    
  } catch (error) {
    console.error('Error in unified topic analysis:', error);
    return NextResponse.json(mockResponse);
  }
}

// Export both GET and POST methods that use the same processing logic
export async function GET() {
  return processTopicAnalysis();
}

export async function POST() {
  return processTopicAnalysis();
}