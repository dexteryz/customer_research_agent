import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ChunkResult {
  content?: string;
  chunk_content?: string;
  similarity?: number;
  chunk_index?: number;
  file_id?: number;
  [key: string]: unknown;
}

// Enhanced query processing functions
function extractKeywords(query: string): string[] {
  const commonWords = ['what', 'how', 'why', 'where', 'when', 'who', 'are', 'is', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once'];
  return query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.includes(word));
}

function expandQuery(query: string): string[] {
  const synonymMap: Record<string, string[]> = {
    'suggestions': ['recommendations', 'advice', 'feedback', 'ideas', 'proposals', 'input', 'thoughts', 'comments'],
    'recommendations': ['suggestions', 'advice', 'feedback', 'ideas', 'proposals'],
    'client': ['customer', 'user', 'client', 'buyer', 'consumer', 'end-user'],
    'customer': ['client', 'user', 'buyer', 'consumer', 'end-user'],
    'issues': ['problems', 'pain points', 'challenges', 'difficulties', 'concerns', 'troubles'],
    'problems': ['issues', 'pain points', 'challenges', 'difficulties', 'concerns', 'troubles'],
    'pain points': ['problems', 'issues', 'challenges', 'difficulties', 'concerns', 'frustrations'],
    'feedback': ['suggestions', 'comments', 'input', 'opinions', 'thoughts', 'reviews'],
    'improve': ['enhance', 'better', 'upgrade', 'fix', 'optimize', 'develop'],
    'pricing': ['price', 'cost', 'fee', 'rate', 'charge', 'payment'],
    'service': ['support', 'help', 'assistance', 'experience'],
    'product': ['solution', 'offering', 'service', 'tool', 'platform'],
    'want': ['need', 'require', 'desire', 'wish', 'expect'],
    'like': ['enjoy', 'appreciate', 'prefer', 'love'],
    'dislike': ['hate', 'disapprove', 'complain', 'criticize'],
  };

  const keywords = extractKeywords(query);
  const expandedTerms = new Set<string>();
  
  // Add original keywords
  keywords.forEach(keyword => expandedTerms.add(keyword));
  
  // Add synonyms
  keywords.forEach(keyword => {
    const synonyms = synonymMap[keyword] || [];
    synonyms.forEach(synonym => expandedTerms.add(synonym));
    
    // Also check if keyword appears in any synonym list values
    Object.entries(synonymMap).forEach(([key, values]) => {
      if (values.includes(keyword)) {
        expandedTerms.add(key);
        values.forEach(v => expandedTerms.add(v));
      }
    });
  });
  
  return Array.from(expandedTerms);
}

function analyzeIntent(query: string): { intent: string; focus: string[]; searchTerms: string[] } {
  const lowerQuery = query.toLowerCase();
  
  // Intent patterns
  const intentPatterns = {
    suggestions: /suggest|recommend|advice|idea|improve|enhancement|what.*should|how.*better/,
    problems: /problem|issue|pain|challenge|difficult|trouble|concern|complaint|wrong/,
    feedback: /feedback|comment|opinion|thought|review|say|mention|tell/,
    summary: /summary|summarize|overview|main|key|important|highlight/,
    specific: /show|find|give.*example|list|what.*exactly/,
    comparison: /compare|versus|vs|difference|better.*than/
  };
  
  let detectedIntent = 'general';
  for (const [intent, pattern] of Object.entries(intentPatterns)) {
    if (pattern.test(lowerQuery)) {
      detectedIntent = intent;
      break;
    }
  }
  
  // Extract focus areas
  const focusPatterns = {
    pricing: /price|cost|fee|expensive|cheap|billing|payment/,
    service: /service|support|help|assistance|customer.*service/,
    product: /product|feature|functionality|tool|platform|solution/,
    experience: /experience|journey|process|workflow|usability/,
    communication: /communication|contact|response|email|phone|chat/
  };
  
  const focus: string[] = [];
  for (const [area, pattern] of Object.entries(focusPatterns)) {
    if (pattern.test(lowerQuery)) {
      focus.push(area);
    }
  }
  
  const searchTerms = expandQuery(query);
  
  return { intent: detectedIntent, focus, searchTerms };
}

export async function POST(req: NextRequest) {
  const { query, topK = 8, conversationHistory } = await req.json();
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  try {
    // Handle cases where API keys are missing - provide helpful error messages
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        answer: "⚠️ OpenAI API key is not configured. Please set up your OPENAI_API_KEY environment variable to enable AI-powered search.",
        error: 'OpenAI API key not configured',
        results: [],
        suggestion: "Contact your administrator to configure the OpenAI API key."
      });
    }
    if (!process.env.CLAUDE_API_KEY) {
      return NextResponse.json({ 
        answer: "⚠️ Claude API key is not configured. Please set up your CLAUDE_API_KEY environment variable to enable AI responses.",
        error: 'Claude API key not configured',
        results: [],
        suggestion: "Contact your administrator to configure the Claude API key."
      });
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ 
        answer: "⚠️ Database connection is not configured. Please set up your Supabase environment variables to store and search data.",
        error: 'Supabase not configured',
        results: [],
        suggestion: "Contact your administrator to configure the Supabase database connection."
      });
    }

    // Analyze user intent and expand query for better search
    const { intent, focus, searchTerms } = analyzeIntent(query);
    console.log('Query analysis:', { intent, focus, searchTerms: searchTerms.slice(0, 5) });

    // Try to embed the query, handle embedding failures gracefully
    let queryEmbedding: number[] = [];
    try {
      const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
      [queryEmbedding] = await embeddings.embedDocuments([query]);
    } catch (embeddingError) {
      console.log('Embedding generation failed, will use text search only:', embeddingError);
      queryEmbedding = []; // Empty array will trigger text search fallback
    }

    // Try vector search first, fallback to regular text search if vector search fails
    let results: unknown[] = [];
    let searchMethod = 'vector';
    
    if (queryEmbedding.length > 0) {
      try {
        const { data: vectorResults, error: vectorError } = await supabase.rpc('match_chunks', {
          query_embedding: queryEmbedding,
          match_count: topK,
        });
        
        if (vectorError) {
          console.log('Vector search not available, falling back to text search:', vectorError.message);
          searchMethod = 'text';
        } else {
          results = vectorResults || [];
        }
      } catch (vectorSearchError) {
        console.log('Vector search failed, falling back to text search:', vectorSearchError);
        searchMethod = 'text';
      }
    } else {
      console.log('No embeddings available, using text search');
      searchMethod = 'text';
    }

    // Fallback to text-based search if vector search failed
    if (searchMethod === 'text') {
      const allResults = new Map<string, ChunkResult>();
      let searchAttempts = 0;
      
      // Try multiple search strategies with expanded terms
      const searchStrategies = [
        // 1. Original query with websearch
        { terms: [query], method: 'websearch' },
        // 2. Expanded search terms
        { terms: searchTerms.slice(0, 5), method: 'websearch' },
        // 3. Basic pattern matching with original query
        { terms: [query], method: 'ilike' },
        // 4. Basic pattern matching with expanded terms  
        { terms: searchTerms.slice(0, 3), method: 'ilike' }
      ];
      
      for (const strategy of searchStrategies) {
        for (const term of strategy.terms) {
          try {
            searchAttempts++;
            let searchResults;
            
            if (strategy.method === 'websearch') {
              const { data, error } = await supabase
                .from('file_chunks')
                .select('content, chunk_index, file_id')
                .textSearch('content', term, { type: 'websearch' })
                .limit(Math.ceil(topK / 2));
              
              if (!error && data) {
                searchResults = data;
              }
            } else if (strategy.method === 'ilike') {
              const { data, error } = await supabase
                .from('file_chunks')
                .select('content, chunk_index, file_id')
                .ilike('content', `%${term}%`)
                .limit(Math.ceil(topK / 2));
                
              if (!error && data) {
                searchResults = data;
              }
            }
            
            // Add unique results to our collection
            if (searchResults) {
              searchResults.forEach(result => {
                const key = `${result.file_id}-${result.chunk_index}`;
                if (!allResults.has(key)) {
                  allResults.set(key, result);
                }
              });
            }
            
            // Stop if we have enough results
            if (allResults.size >= topK) break;
            
          } catch (searchError) {
            console.log(`Search attempt ${searchAttempts} failed for term "${term}":`, searchError);
          }
        }
        
        // Stop if we have enough results
        if (allResults.size >= topK) break;
      }
      
      results = Array.from(allResults.values()).slice(0, topK);
      console.log(`Found ${results.length} results using ${searchAttempts} search attempts`);
    }

    // Fallback if no results found - provide helpful guidance
    if (!results || results.length === 0) {
      // Check if there's any data in the database at all
      const { count } = await supabase
        .from('file_chunks')
        .select('*', { count: 'exact', head: true });
      
      if (!count || count === 0) {
        // No data uploaded - provide helpful response
        return NextResponse.json({ 
          answer: `I don't have any customer feedback data to analyze yet. Here's how to get started:

**To upload data:**
1. Click the upload button (folder icon) in the bottom-right corner
2. Upload CSV, Excel, or PDF files containing customer feedback
3. Wait for processing to complete
4. Then ask me questions about your data!

**Example questions you can ask once data is uploaded:**
• "What are the main customer pain points?"
• "Summarize the key feedback themes"
• "What do customers say about pricing?"
• "Show me positive customer quotes"

**Alternative:** You can also import data from Notion using the /api/notion-data-import endpoint if you have meeting notes or feedback stored there.`, 
          results: [],
          searchMethod,
          hasData: false,
          suggestion: "Upload customer feedback files to start analyzing your data."
        });
      } else {
        // Data exists but no matches found
        return NextResponse.json({ 
          answer: `I have ${count} chunks of customer data, but couldn't find anything relevant to "${query}".

**Try rephrasing your question:**
• Use broader terms (e.g., "feedback" instead of specific product names)
• Ask about common topics like "pain points", "complaints", or "suggestions"
• Try questions like "summarize the data" or "what are the main themes"

**Or browse these general topics:**
• Customer pain points and frustrations
• Product feedback and suggestions  
• Service quality and experience
• Pricing and value perception`, 
          results: [],
          searchMethod,
          hasData: true,
          totalChunks: count,
          suggestion: "Try broader search terms or ask about general feedback themes."
        });
      }
    }

    // Each result should include chunk content and metadata
    
    const chunks = results as ChunkResult[];
    const context = chunks.map(r => r.content || r.chunk_content || '').join('\n---\n');
    
    // Enhanced prompt for customer research context with intent awareness
    const prompt = new PromptTemplate({
      template: `You are an AI research assistant specializing in customer research analysis. You help analyze customer feedback, pain points, and insights from uploaded data.

**User's Query Intent**: {intent}
**Focus Areas**: {focus}
**Search Method Used**: {searchMethod}

Given the following customer feedback data, answer the user's question accurately and helpfully. Based on the detected intent, focus on:

${intent === 'suggestions' ? `
- Extract specific recommendations and suggestions from customers
- Identify improvement ideas and feature requests
- Look for what customers explicitly want or need
- Find patterns in customer advice and input
` : intent === 'problems' ? `
- Identify customer pain points and frustrations  
- Extract complaints and difficulties mentioned
- Highlight areas where customers struggle
- Focus on problems that need solutions
` : intent === 'feedback' ? `
- Summarize what customers are saying
- Extract direct quotes and opinions
- Identify themes in customer comments
- Focus on customer voice and perspectives
` : intent === 'summary' ? `
- Provide a high-level overview of key themes
- Identify the most important patterns
- Summarize main insights and findings
- Give a comprehensive but concise analysis
` : `
- Identify key patterns and trends
- Extract actionable insights  
- Highlight customer pain points or positive feedback
- Provide data-driven recommendations when appropriate
`}

**Important**: Be flexible and adaptive. If the user asks "what are suggestions from the client?" they mean the same as "customer recommendations" or "client feedback" or "user input." Look beyond exact word matches to understand the meaning and intent.

Context from customer feedback data:
{context}

${conversationHistory ? `Previous conversation context:
${conversationHistory}

` : ''}Current question: {question}

Provide a comprehensive, well-structured answer that directly addresses what the user is looking for:`,
      inputVariables: ['context', 'question', 'conversationHistory', 'intent', 'focus', 'searchMethod'],
    });

    const llm = new ChatAnthropic({
      apiKey: process.env.CLAUDE_API_KEY!,
      model: 'claude-3-5-sonnet-20240620',
      temperature: 0.1,
      maxTokens: 800,
    });

    const chain = RunnableSequence.from([prompt, llm]);
    
    const answerResult = await chain.invoke({ 
      context, 
      question: query,
      conversationHistory: conversationHistory || '',
      intent,
      focus: focus.join(', ') || 'general',
      searchMethod
    });
    
    const answer = typeof answerResult === 'string' ? answerResult : (answerResult.text || answerResult.content || '');
    
    return NextResponse.json({ 
      answer, 
      results: chunks.slice(0, 5), // Return top 5 most relevant chunks
      totalResults: chunks.length,
      queryAnalysis: {
        intent,
        focus,
        searchMethod,
        searchTermsUsed: searchTerms.slice(0, 5),
        originalQuery: query
      }
    });
    
  } catch (error) {
    console.error('RAG search error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 