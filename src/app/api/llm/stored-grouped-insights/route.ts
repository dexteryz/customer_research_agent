import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface GroupedInsight {
  insight_statement: string;
  quotes: Array<{
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
  total_mentions: number;
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

    // Group insights by topic
    const topicMap = new Map<string, {
      topic: string;
      summary: string;
      recommendations: string[];
      total_mentions: number;
      insights: Array<{
        insight_index: number;
        insight_statement: string;
        quotes: Array<{
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
          summary: (metadata.summary as string) || '',
          recommendations: (metadata.recommendations as string[]) || [],
          total_mentions: (metadata.total_mentions as number) || 0,
          insights: []
        });
      }

      const topicData = topicMap.get(topic)!;
      topicData.insights.push({
        insight_index: (metadata.insight_index as number) || 0,
        insight_statement: insight.content,
        quotes: (metadata.quotes as Array<{
          text: string;
          chunk_id: string;
          relevance: number;
          source?: string;
        }>) || [],
        recommendations: (metadata.group_recommendations as string[]) || []
      });
    }

    // Convert to final format
    const processedInsights: TopicInsightGrouped[] = Array.from(topicMap.values()).map(topicData => {
      // Sort insights by index
      const sortedInsights = topicData.insights.sort((a, b) => a.insight_index - b.insight_index);
      
      return {
        topic: topicData.topic,
        summary: topicData.summary,
        grouped_insights: sortedInsights.map(insight => ({
          insight_statement: insight.insight_statement,
          quotes: insight.quotes,
          recommendations: insight.recommendations
        })),
        recommendations: topicData.recommendations,
        total_mentions: topicData.total_mentions
      };
    });

    // Generate chart data
    const chartData = processedInsights.map(insight => ({
      name: insight.topic,
      value: insight.total_mentions
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