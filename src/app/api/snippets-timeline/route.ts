import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({
        timelineData: generateMockTimelineData(),
        isDemo: true
      });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Query insights to get topic-specific snippets with original dates
    const { data: insights, error } = await supabase
      .from('llm_insights')
      .select(`
        insight_type,
        content,
        metadata,
        created_at
      `)
      .in('insight_type', [
        'pain_points_quote',
        'blockers_quote', 
        'customer_requests_quote',
        'solution_feedback_quote'
      ])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching insights timeline:', error);
      return NextResponse.json({
        timelineData: generateMockTimelineData(),
        isDemo: true
      });
    }

    if (!insights || insights.length === 0) {
      return NextResponse.json({
        timelineData: generateMockTimelineData(),
        isDemo: true
      });
    }

    // For each insight, try to get the original date from the associated file chunk
    const insightsWithDates = await Promise.all(
      insights.map(async (insight) => {
        const metadata = insight.metadata as { chunk_id?: string } || {};
        let originalDate = null;

        if (metadata.chunk_id) {
          // Get the original_date from the file_chunks table
          const { data: chunkData } = await supabase
            .from('file_chunks')
            .select('original_date')
            .eq('id', metadata.chunk_id)
            .single();
          
          originalDate = chunkData?.original_date;
        }

        // Fallback to created_at if no original date found
        const dateToUse = originalDate || insight.created_at;

        return {
          ...insight,
          date_for_timeline: dateToUse
        };
      })
    );

    // Group by date and topic
    const dateTopicCounts: { [date: string]: { [topic: string]: number } } = {};
    
    for (const insight of insightsWithDates) {
      if (!insight.date_for_timeline) continue;
      
      const date = new Date(insight.date_for_timeline).toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Map insight_type to display topic name
      let topic = '';
      if (insight.insight_type.includes('pain_points')) topic = 'Pain Points';
      else if (insight.insight_type.includes('blockers')) topic = 'Blockers';
      else if (insight.insight_type.includes('customer_requests')) topic = 'Customer Requests';
      else if (insight.insight_type.includes('solution_feedback')) topic = 'Solution Feedback';
      
      if (!topic) continue;
      
      if (!dateTopicCounts[date]) {
        dateTopicCounts[date] = {
          'Pain Points': 0,
          'Blockers': 0,
          'Customer Requests': 0,
          'Solution Feedback': 0
        };
      }
      
      dateTopicCounts[date][topic]++;
    }

    // Convert to array format for recharts stacked bar chart
    const timelineData = Object.entries(dateTopicCounts)
      .map(([date, counts]) => ({
        date,
        'Pain Points': counts['Pain Points'] || 0,
        'Blockers': counts['Blockers'] || 0,
        'Customer Requests': counts['Customer Requests'] || 0,
        'Solution Feedback': counts['Solution Feedback'] || 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      timelineData,
      isDemo: false,
      stats: {
        totalDates: timelineData.length,
        totalSnippets: insightsWithDates.length,
        dateRange: timelineData.length > 0 ? {
          earliest: timelineData[0].date,
          latest: timelineData[timelineData.length - 1].date
        } : null
      }
    });

  } catch (error) {
    console.error('Failed to fetch snippets timeline:', error);
    return NextResponse.json({
      timelineData: generateMockTimelineData(),
      isDemo: true
    });
  }
}

function generateMockTimelineData() {
  const mockData = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  for (let i = 0; i < 15; i += 2) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    mockData.push({
      date: date.toISOString().split('T')[0],
      'Pain Points': Math.floor(Math.random() * 8) + 1,
      'Blockers': Math.floor(Math.random() * 5) + 1,
      'Customer Requests': Math.floor(Math.random() * 10) + 2,
      'Solution Feedback': Math.floor(Math.random() * 6) + 1,
    });
  }
  
  return mockData;
}