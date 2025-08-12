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

    // Query chunks with original dates
    const { data: chunks, error } = await supabase
      .from('file_chunks')
      .select(`
        id,
        content,
        original_date,
        created_at,
        uploaded_files!inner(name, type)
      `)
      .not('original_date', 'is', null)
      .order('original_date', { ascending: true });

    if (error) {
      console.error('Error fetching chunks timeline:', error);
      return NextResponse.json({
        timelineData: generateMockTimelineData(),
        isDemo: true
      });
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        timelineData: generateMockTimelineData(),
        isDemo: true
      });
    }

    // Group chunks by original date (day level)
    const dateGroups: { [date: string]: number } = {};
    
    chunks.forEach(chunk => {
      if (chunk.original_date) {
        const date = new Date(chunk.original_date).toISOString().split('T')[0];
        dateGroups[date] = (dateGroups[date] || 0) + 1;
      }
    });

    // Convert to timeline format
    const timelineData = Object.entries(dateGroups)
      .map(([date, count]) => ({
        date,
        chunks: count,
        label: `${count} feedback${count !== 1 ? 's' : ''}`
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      timelineData,
      isDemo: false,
      stats: {
        totalChunks: chunks.length,
        dateRange: {
          earliest: timelineData[0]?.date,
          latest: timelineData[timelineData.length - 1]?.date
        },
        avgPerDay: Math.round(chunks.length / timelineData.length * 10) / 10
      }
    });

  } catch (error) {
    console.error('Failed to fetch chunks timeline:', error);
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
  
  for (let i = 0; i < 30; i += 3) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const count = Math.floor(Math.random() * 8) + 1;
    
    mockData.push({
      date: date.toISOString().split('T')[0],
      chunks: count,
      label: `${count} feedback${count !== 1 ? 's' : ''}`
    });
  }
  
  return mockData;
}