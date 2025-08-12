import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Generate topic summaries with updated definitions
function generateTopicSummary(topic: string, totalMentions: number): string {
  const definitions = {
    'Pain Points': 'Emotional frustrations, stress, confusion, and negative experiences that affect user satisfaction. Focus on feelings and experience quality rather than implementation barriers.',
    'Blockers': 'Specific obstacles that prevent progress despite high customer motivation or desire to act. Must show clear intent blocked by external barriers, not general complaints.',
    'Customer Requests': 'Explicit asks for new features, enhancements, services, or program improvements. Concrete requests with specific implementation language like "add", "provide", or "build".',
    'Solution Feedback': 'Feedback on existing solutions, how well current features work, and user experience with current offerings. Evaluates what\'s already implemented.'
  };
  
  const definition = definitions[topic as keyof typeof definitions] || 'Customer feedback in this category.';
  
  if (totalMentions === 0) return `No specific ${topic.toLowerCase()} found in customer feedback.`;
  return definition;
}

interface GroupedInsight {
  insight_statement: string;
  snippets: Array<{
    text: string;
    chunk_id: string;
    relevance: number;
    source?: string;
  }>;
}

interface TopicInsightGrouped {
  topic: string;
  summary: string;
  grouped_insights: GroupedInsight[];
  recommendations: string[];
  total_snippets: number;
}

interface GroupedTopicResponse {
  chartData: Array<{ name: string; value: number }>;
  insights: TopicInsightGrouped[];
  isDemo?: boolean;
}

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('Supabase not configured, returning empty data');
    return NextResponse.json({
      chartData: [],
      insights: [],
      isDemo: true
    });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Get all grouped insights from database
    const { data: storedInsights, error } = await supabase
      .from('llm_insights')
      .select('*')
      .like('insight_type', '%grouped_insight%')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching grouped insights:', error);
      return NextResponse.json({
        chartData: [],
        insights: [],
        isDemo: true
      });
    }

    if (!storedInsights || storedInsights.length === 0) {
      console.log('No stored grouped insights found');
      return NextResponse.json({
        chartData: [],
        insights: [],
        isDemo: true
      });
    }

    // Get current individual insights to calculate accurate mention counts
    const { data: currentInsights } = await supabase
      .from('llm_insights')
      .select('insight_type, content')
      .in('insight_type', [
        'pain_points_quote', 'blockers_quote', 'customer_requests_quote', 'solution_feedback_quote'
      ]);

    // Group insights by topic
    const topicMap = new Map<string, {
      topic: string;
      summary: string;
      recommendations: string[];
      total_snippets: number;
      insights: Array<{
        insight_index: number;
        insight_statement: string;
        snippets: Array<{
          text: string;
          chunk_id: string;
          relevance: number;
          source?: string;
        }>;
        recommendations: string[];
      }>;
    }>();

    // Process stored insights
    for (const insight of storedInsights) {
      const metadata = insight.metadata as Record<string, unknown>;
      const topic = metadata.topic as string;

      if (!topicMap.has(topic)) {
        topicMap.set(topic, {
          topic,
          summary: generateTopicSummary(topic, ((metadata.theme_total_snippets as number) || (metadata.total_mentions as number)) || 0),
          recommendations: (metadata.recommendations as string[]) || [],
          total_snippets: ((metadata.theme_total_snippets as number) || (metadata.total_mentions as number)) || 0,
          insights: []
        });
      }

      const topicData = topicMap.get(topic)!;
      topicData.insights.push({
        insight_index: (metadata.insight_index as number) || 0,
        insight_statement: insight.content,
        snippets: (metadata.snippets || metadata.quotes) as Array<{
          text: string;
          chunk_id: string;
          relevance: number;
          source?: string;
        }> || [],
        recommendations: (metadata.group_recommendations as string[]) || []
      });
    }

    // Calculate current snippet counts from individual insights
    const currentSnippetCounts = new Map<string, number>();
    if (currentInsights) {
      for (const insight of currentInsights) {
        const topicKey = insight.insight_type.replace('_quote', '').replace('_', ' ');
        const topic = topicKey.split(' ').map((word: string) => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        
        currentSnippetCounts.set(topic, (currentSnippetCounts.get(topic) || 0) + 1);
      }
    }

    // Convert to final format
    const processedInsights: TopicInsightGrouped[] = Array.from(topicMap.values()).map(topicData => {
      // Sort insights by index
      const sortedInsights = topicData.insights.sort((a, b) => a.insight_index - b.insight_index);
      
      // Use current snippet count instead of cached count
      const currentSnippets = currentSnippetCounts.get(topicData.topic) || 0;
      
      return {
        topic: topicData.topic,
        summary: topicData.summary,
        grouped_insights: sortedInsights.map(insight => ({
          insight_statement: insight.insight_statement,
          snippets: insight.snippets,
          recommendations: insight.recommendations
        })),
        recommendations: topicData.recommendations,
        total_snippets: currentSnippets // Use current count from database
      };
    });

    // Generate chart data
    const chartData = processedInsights.map(insight => ({
      name: insight.topic,
      value: insight.total_snippets
    }));

    const response: GroupedTopicResponse = {
      chartData,
      insights: processedInsights,
      isDemo: false
    };

    console.log(`Retrieved ${processedInsights.length} grouped topic insights from database`);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error retrieving stored grouped insights:', error);
    return NextResponse.json({
      chartData: [],
      insights: [],
      isDemo: true
    });
  }
}