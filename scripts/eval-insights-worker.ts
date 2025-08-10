require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const { ChatAnthropic } = require('@langchain/anthropic');
const { RunnableSequence } = require('@langchain/core/runnables');
const { PromptTemplate } = require('@langchain/core/prompts');

// Check if required environment variables are set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables. Worker will not function properly.');
  process.exit(1);
}

if (!process.env.CLAUDE_API_KEY) {
  console.error('Missing Claude API key. Worker will not function properly.');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Test Supabase connection
async function testConnection() {
  try {
    const { error } = await supabase.from('llm_insights').select('count', { count: 'exact', head: true });
    if (error) {
      console.error('Supabase connection test failed:', error.message);
      return false;
    }
    console.log('Eval worker: Supabase connection successful');
    return true;
  } catch (err) {
    console.error('Supabase connection test error:', err);
    return false;
  }
}

const llm = new ChatAnthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
  model: 'claude-3-5-sonnet-20240620',
  temperature: 0,
  maxTokens: 1024,
});

const hallucinationPrompt = new PromptTemplate({
  template: `You are evaluating whether a customer insight is grounded in the source content or contains fabricated information.

    # Topic Category: {query}
    # Source Content: {reference}
    # Customer Insight: {response}

Determine if the Customer Insight is factually supported by the Source Content:

- "factual" means the insight accurately reflects information found in the source content
- "hallucinated" means the insight contains claims, details, or implications not supported by the source content

For recommendations and summaries: Be more lenient - they can extrapolate reasonably from the source as long as the core claims are grounded.

For quotes: Must be directly supported by the source content.

Your response must be a single word: either "factual" or "hallucinated".`,
  inputVariables: ['query', 'reference', 'response'],
});

const relevancePrompt = new PromptTemplate({
  template: `You are evaluating whether a customer insight is correctly categorized under a specific topic category. Here is the data:
    [BEGIN DATA]
    ************
    [Topic Category]: {query}
    ************
    [Customer Insight]: {reference}
    [END DATA]

Evaluate whether the Customer Insight above is correctly categorized under the Topic Category.

Topic Category Definitions:
- "Pain Points": Emotional frustrations, stress, confusion, dissatisfaction, negative experiences, user difficulties, workflow friction, or anything that causes customer discomfort or annoyance
- "Blockers": Technical barriers, implementation obstacles, system limitations, process bottlenecks, missing capabilities, API issues, integration problems, or anything that prevents customers from completing tasks or achieving goals
- "Customer Requests": Explicit asks for new features, enhancements, services, program improvements, integrations, or any specific functionality customers want added or changed
- "Solution Feedback": Feedback on existing solutions, current feature performance, user experience reports, product effectiveness, or opinions about how well current offerings work

Your response must be a single word, either "relevant" or "unrelated",
and should not contain any text or characters aside from that word.
"relevant" means the insight correctly belongs in this topic category.
"unrelated" means the insight does not belong in this topic category.`,
  inputVariables: ['query', 'reference'],
});

async function evalInsight({ insight, originalData, mode }: { insight: string; originalData: unknown; mode: string; }) {
  // Hallucination eval
  let hallucination = 'factual';
  try {
    const hallucinationChain = RunnableSequence.from([hallucinationPrompt, llm]);
    const hallucinationResult = await hallucinationChain.invoke({
      query: mode,
      reference: typeof originalData === 'string' ? originalData : JSON.stringify(originalData),
      response: insight,
    });
    const hallucinationText = typeof hallucinationResult === 'string' ? hallucinationResult : (hallucinationResult.text || '');
    if (hallucinationText.trim().toLowerCase().startsWith('hallucinated')) hallucination = 'hallucinated';
  } catch (err) {
    console.error('Hallucination eval error:', err);
  }
  // Relevance eval - test if insight belongs in its topic category
  let relevance = 'relevant';
  try {
    const relevanceChain = RunnableSequence.from([relevancePrompt, llm]);
    const relevanceResult = await relevanceChain.invoke({
      query: mode, // This should be the topic category name
      reference: insight, // The insight content to evaluate
    });
    const relevanceText = typeof relevanceResult === 'string' ? relevanceResult : (relevanceResult.text || '');
    if (relevanceText.trim().toLowerCase().startsWith('unrelated')) relevance = 'unrelated';
  } catch (err) {
    console.error('Relevance eval error:', err);
  }
  return { hallucination, relevance };
}

let isRunning = false;

async function processInsights() {
  if (isRunning) {
    console.log('Eval worker: previous run still in progress, skipping this interval.');
    return;
  }
  
  // Check if we have required environment variables before proceeding
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.CLAUDE_API_KEY) {
    console.log('Eval worker: Missing required environment variables, skipping processing.');
    return;
  }
  
  isRunning = true;
  console.log(`[${new Date().toISOString()}] Eval worker: Querying unevaluated insights...`);
  try {
    // Query for insights that don't have evaluation results yet
    // Check for null or missing eval fields using simpler syntax
    const { data: insights, error } = await supabase
      .from('llm_insights')
      .select('*')
      .is('metadata->eval', null)
      .limit(20); // Process in smaller batches
      
    if (error) {
      console.error('Error querying insights:', {
        message: error.message || 'Unknown error',
        details: error.details || 'No details available',
        hint: error.hint || '',
        code: error.code || ''
      });
      isRunning = false;
      return;
    }
    
    if (!insights || insights.length === 0) {
      console.log('No unevaluated insights found.');
      isRunning = false;
      return;
    }
    
    console.log(`Found ${insights.length} unevaluated insights.`);
    let updated = 0;
    
    // Track performance metrics
    const performanceMetrics = {
      totalInsights: insights.length,
      byType: {} as Record<string, number>,
      relevanceStats: { relevant: 0, unrelated: 0 },
      hallucinationStats: { factual: 0, hallucinated: 0 }
    };
    
    // Process insights in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < insights.length; i += batchSize) {
      const batch = insights.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(insights.length/batchSize)} (${batch.length} insights)`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (insight: any) => {
        const { id, content, insight_type, metadata } = insight;
        
        // Determine the evaluation mode and original data source
        let mode = insight_type;
        let originalData = '';
        
        // Extract topic category for relevance evaluation
        let topicCategory = '';
        
        // Extract the topic category from the insight_type and metadata
        if (insight_type.includes('pain_points')) {
          topicCategory = 'Pain Points';
        } else if (insight_type.includes('blockers')) {
          topicCategory = 'Blockers';
        } else if (insight_type.includes('customer_requests')) {
          topicCategory = 'Customer Requests';
        } else if (insight_type.includes('solution_feedback')) {
          topicCategory = 'Solution Feedback';
        } else if (metadata?.topic) {
          topicCategory = metadata.topic;
        } else {
          topicCategory = 'Unknown';
        }
        
        // Set mode to the topic category for relevance evaluation
        mode = topicCategory;
        
        // Extract original data for hallucination evaluation
        if (insight_type.includes('quote')) {
          // For quotes, we need the actual chunk content for hallucination check
          const chunkId = metadata?.chunk_id;
          if (chunkId) {
            try {
              const { data: chunkData, error: chunkError } = await supabase
                .from('file_chunks')
                .select('content')
                .eq('id', chunkId)
                .single();
              
              if (!chunkError && chunkData) {
                originalData = chunkData.content;
              } else {
                originalData = `Topic: ${metadata?.topic || 'Unknown'}`;
              }
            } catch {
              originalData = `Topic: ${metadata?.topic || 'Unknown'}`;
            }
          } else {
            originalData = `Topic: ${metadata?.topic || 'Unknown'}`;
          }
        } else {
          // For recommendations and summaries, use metadata
          originalData = metadata?.summary || metadata?.topic || JSON.stringify(metadata) || '';
        }
        
        try {
          const evalResult = await evalInsight({ 
            insight: content, 
            originalData, 
            mode 
          });
          
          const newMetadata = { 
            ...metadata, 
            eval: {
              ...evalResult,
              evaluated_at: new Date().toISOString(),
              mode: mode
            }
          };
          
          const { error: updateError } = await supabase
            .from('llm_insights')
            .update({ metadata: newMetadata })
            .eq('id', id);
            
          if (updateError) {
            console.error(`Failed to update eval for insight ${id}:`, updateError);
            return { success: false, id };
          } else {
            console.log(`✓ Updated eval for insight ${id} (${insight_type} -> ${topicCategory}):`, evalResult);
            
            // Track performance metrics
            performanceMetrics.byType[topicCategory] = (performanceMetrics.byType[topicCategory] || 0) + 1;
            performanceMetrics.relevanceStats[evalResult.relevance as 'relevant' | 'unrelated']++;
            performanceMetrics.hallucinationStats[evalResult.hallucination as 'factual' | 'hallucinated']++;
            
            return { success: true, id, evalResult };
          }
        } catch (error) {
          console.error(`Error evaluating insight ${id}:`, error);
          return { success: false, id, error };
        }
      });
      
      const results = await Promise.allSettled(batchPromises);
      const batchUpdated = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;
      updated += batchUpdated;
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < insights.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Eval complete. Updated ${updated}/${insights.length} insights.`);
    
    // Performance summary
    if (updated > 0) {
      console.log('\n📊 Performance Summary:');
      console.log(`  Relevance: ${performanceMetrics.relevanceStats.relevant}/${updated} relevant (${Math.round(100 * performanceMetrics.relevanceStats.relevant / updated)}%)`);
      console.log(`  Quality: ${performanceMetrics.hallucinationStats.factual}/${updated} factual (${Math.round(100 * performanceMetrics.hallucinationStats.factual / updated)}%)`);
      console.log('  By Category:');
      Object.entries(performanceMetrics.byType).forEach(([category, count]) => {
        console.log(`    ${category}: ${count} insights`);
      });
    }
  } catch (err) {
    console.error('Fatal error in eval worker:', err);
  }
  isRunning = false;
}

// Run immediately, then every 2 minutes for faster evaluation of new insights
// Wait 10 seconds before first run to ensure server is ready
setTimeout(async () => {
  console.log('Eval worker: Starting processing after initial delay...');
  const connected = await testConnection();
  if (connected) {
    processInsights(); // Run immediately after delay if connection is good
  } else {
    console.log('Eval worker: Skipping initial run due to connection issues');
  }
}, 10000);

// Check every 2 minutes for new insights to evaluate
const interval = setInterval(processInsights, 2 * 60 * 1000);

// Graceful shutdown
function shutdown() {
  console.log('Eval worker shutting down...');
  clearInterval(interval);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown); 