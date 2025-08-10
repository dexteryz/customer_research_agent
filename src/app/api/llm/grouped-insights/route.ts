import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ChatAnthropic } from '@langchain/anthropic';

interface GroupedInsight {
  insight_statement: string;
  quotes: Array<{
    text: string;
    chunk_id: string;
    relevance: number;
    source?: string;
  }>;
  recommendations: string[];
}

interface TopicInsightGrouped {
  topic: string;
  summary: string;
  grouped_insights: GroupedInsight[];
  recommendations: string[];
  total_mentions: number;
}

interface GroupedTopicResponse {
  chartData: Array<{ name: string; value: number }>;
  insights: TopicInsightGrouped[];
}

// Enhanced prompt for grouping quotes into insights
const GROUPING_PROMPT = `You are analyzing customer feedback quotes to group them into common insights. For each topic category, group related quotes together and create synthesized insight statements.

INSTRUCTIONS:
1. Group similar quotes that express the same underlying insight or concern
2. Create a clear, actionable insight statement for each group (1-2 sentences)
3. Generate 2-3 specific, actionable recommendations for each insight group
4. Each group should contain 2-8 related quotes that support the same insight
5. Insight statements should be specific and actionable, not generic
6. Recommendations should be concrete actions that directly address the grouped insight
7. Focus on the customer's perspective and pain points

TOPIC: {topic}
QUOTES TO ANALYZE:
{quotes}

Please respond with a JSON array of grouped insights in this exact format:
[
  {
    "insight_statement": "Clear, specific insight based on the grouped quotes",
    "quote_indices": [0, 2, 5],
    "recommendations": [
      "Specific actionable recommendation 1 for this insight",
      "Specific actionable recommendation 2 for this insight"
    ]
  },
  {
    "insight_statement": "Another distinct insight from different quotes", 
    "quote_indices": [1, 3, 4],
    "recommendations": [
      "Different recommendation 1 for this different insight",
      "Different recommendation 2 for this different insight"
    ]
  }
]

Make sure insight statements are:
- Specific to the customer experience
- Actionable for product teams
- Distinct from each other
- Supported by multiple quotes when possible`;

interface Quote {
  text: string;
  chunk_id: string;
  relevance: number;
  source?: string;
}

async function groupQuotesIntoInsights(topic: string, quotes: Quote[]): Promise<GroupedInsight[]> {
  if (!process.env.CLAUDE_API_KEY) {
    console.log('Claude API key not found, skipping quote grouping');
    return [];
  }

  try {
    const model = new ChatAnthropic({
      anthropicApiKey: process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-5-sonnet-20241022',
      temperature: 0.1,
    });

    const quotesText = quotes
      .map((quote, index) => `${index}. "${quote.text}" (Source: ${quote.source || 'Unknown'})`)
      .join('\n');

    const prompt = GROUPING_PROMPT
      .replace('{topic}', topic)
      .replace('{quotes}', quotesText);

    const response = await model.invoke([{ role: 'user', content: prompt }]);
    const content = typeof response.content === 'string' ? response.content : '';
    
    // Parse the LLM response
    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      console.log('No valid JSON found in LLM response');
      return [];
    }

    const jsonContent = content.slice(jsonStart, jsonEnd);
    const groupings = JSON.parse(jsonContent);

    // Convert the groupings into grouped insights
    interface GroupingResult {
      insight_statement: string;
      quote_indices: number[];
      recommendations: string[];
    }
    
    const groupedInsights: GroupedInsight[] = (groupings as GroupingResult[]).map((group) => ({
      insight_statement: group.insight_statement,
      quotes: group.quote_indices.map((index: number) => quotes[index]).filter(Boolean),
      recommendations: group.recommendations || []
    }));

    return groupedInsights;

  } catch (error) {
    console.error(`Error grouping quotes for ${topic}:`, error);
    return [];
  }
}

export async function GET() {
  try {
    // Query database directly to get ALL insights and accurate counts
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Get all insights from database
    const { data: allInsights, error: insightsError } = await supabase
      .from('llm_insights')
      .select('insight_type, content, metadata')
      .in('insight_type', [
        'pain_points_recommendation', 'pain_points_quote', 'pain_points_summary',
        'blockers_recommendation', 'blockers_quote', 'blockers_summary',
        'customer_requests_recommendation', 'customer_requests_quote', 'customer_requests_summary',
        'solution_feedback_recommendation', 'solution_feedback_quote', 'solution_feedback_summary'
      ]);

    if (insightsError || !allInsights || allInsights.length === 0) {
      return NextResponse.json({ 
        chartData: [], 
        insights: [],
        message: 'No insights found in database' 
      });
    }

    // Process each topic to group quotes into insights
    const enhancedInsights: TopicInsightGrouped[] = [];
    const topics = ['Pain Points', 'Blockers', 'Customer Requests', 'Solution Feedback'];

    for (const topic of topics) {
      const topicKey = topic.toLowerCase().replace(' ', '_');
      const topicInsights = allInsights.filter(insight => 
        insight.insight_type.startsWith(topicKey)
      );

      if (topicInsights.length === 0) continue;

      // Get ALL quotes for this topic (not just high-relevance ones)
      const allQuotes = topicInsights
        .filter(insight => insight.insight_type.endsWith('_quote'))
        .map(insight => {
          const metadata = insight.metadata as Record<string, unknown>;
          return {
            text: insight.content,
            chunk_id: (metadata?.chunk_id as string) || 'unknown',
            relevance: (metadata?.relevance as number) || 3,
            source: (metadata?.source as string) || undefined
          };
        })
        .sort((a, b) => b.relevance - a.relevance);

      // Get recommendations
      const recommendations = topicInsights
        .filter(insight => insight.insight_type.endsWith('_recommendation'))
        .map(insight => insight.content)
        .slice(0, 3);

      // Get summary
      const summaryInsight = topicInsights.find(insight => 
        insight.insight_type.endsWith('_summary')
      );
      const summary = summaryInsight?.content || `${topic} analysis based on customer feedback`;

      const insight = {
        topic,
        summary,
        snippets: allQuotes,
        recommendations,
        total_mentions: allQuotes.length // Use ALL quotes count
      };
      if (insight.snippets.length === 0) {
        // No quotes to group, create a simple grouped version
        enhancedInsights.push({
          topic: insight.topic,
          summary: insight.summary,
          grouped_insights: [],
          recommendations: insight.recommendations,
          total_mentions: insight.total_mentions
        });
        continue;
      }

      console.log(`Grouping ${insight.snippets.length} quotes for topic: ${insight.topic}`);
      const groupedInsights = await groupQuotesIntoInsights(insight.topic, insight.snippets);

      enhancedInsights.push({
        topic: insight.topic,
        summary: insight.summary,
        grouped_insights: groupedInsights,
        recommendations: insight.recommendations,
        total_mentions: insight.total_mentions
      });
    }

    // Store grouped insights in database
    await storeGroupedInsights(enhancedInsights);

    // Build chart data from enhanced insights
    const chartData = enhancedInsights.map(insight => ({
      name: insight.topic,
      value: insight.total_mentions
    })).sort((a, b) => b.value - a.value);

    const response_data: GroupedTopicResponse = {
      chartData,
      insights: enhancedInsights
    };

    return NextResponse.json(response_data);

  } catch (error) {
    console.error('Error in grouped insights analysis:', error);
    return NextResponse.json(
      { error: 'Failed to generate grouped insights' },
      { status: 500 }
    );
  }
}

// Store grouped insights in database
async function storeGroupedInsights(insights: TopicInsightGrouped[]): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('Supabase not configured, skipping grouped insight storage');
    return;
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Clear existing grouped insights
    await supabase.from('llm_insights').delete().like('insight_type', '%grouped_insight%');

    const insightRows: Array<{
      file_id: number | null;
      user_id: string | null;
      insight_type: string;
      content: string;
      metadata: Record<string, unknown>;
    }> = [];
    
    for (const topicData of insights) {
      const topicType = topicData.topic.toLowerCase().replace(' ', '_');
      
      // Store each grouped insight
      for (let i = 0; i < topicData.grouped_insights.length; i++) {
        const insight = topicData.grouped_insights[i];
        insightRows.push({
          file_id: null,
          user_id: null,
          insight_type: `${topicType}_grouped_insight`,
          content: insight.insight_statement,
          metadata: {
            topic: topicData.topic,
            insight_index: i,
            quotes: insight.quotes,
            total_quotes: insight.quotes.length,
            summary: topicData.summary,
            group_recommendations: insight.recommendations,
            theme_recommendations: topicData.recommendations,
            total_mentions: topicData.total_mentions
          }
        });
      }
    }
    
    if (insightRows.length > 0) {
      const { error } = await supabase.from('llm_insights').insert(insightRows);
      if (error) {
        console.error('Error storing grouped insights:', error);
      } else {
        console.log(`Stored ${insightRows.length} grouped insights in database`);
      }
    }
    
  } catch (error) {
    console.error('Failed to store grouped insights:', error);
  }
}