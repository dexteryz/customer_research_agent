require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function resetEvaluations() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Database not configured');
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    console.log('Resetting all evaluations...');
    
    // Get all insights with evaluations
    const { data: insights, error: fetchError } = await supabase
      .from('llm_insights')
      .select('id, metadata')
      .not('metadata->eval', 'is', null);

    if (fetchError) {
      console.error('Error fetching insights:', fetchError);
      return;
    }

    if (!insights || insights.length === 0) {
      console.log('No evaluated insights found to reset.');
      return;
    }

    console.log(`Found ${insights.length} evaluated insights to reset.`);

    // Reset evaluation data for each insight
    let resetCount = 0;
    for (const insight of insights) {
      const metadata = insight.metadata as Record<string, unknown>;
      
      // Remove eval data from metadata
      if (metadata && metadata.eval) {
        const updatedMetadata = { ...metadata };
        delete updatedMetadata.eval;

        const { error: updateError } = await supabase
          .from('llm_insights')
          .update({ metadata: updatedMetadata })
          .eq('id', insight.id);

        if (updateError) {
          console.error(`Error resetting insight ${insight.id}:`, updateError);
        } else {
          resetCount++;
          if (resetCount % 10 === 0) {
            console.log(`Reset ${resetCount}/${insights.length} insights...`);
          }
        }
      }
    }

    console.log(`Successfully reset ${resetCount} evaluations.`);
    console.log('All evaluation data has been cleared. The eval worker will re-evaluate insights on its next run.');
    
  } catch (error) {
    console.error('Error resetting evaluations:', error);
  }
}

resetEvaluations();