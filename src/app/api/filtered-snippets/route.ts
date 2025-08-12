import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export interface FilteredSnippet {
  id: string;
  text: string;
  topic: string;
  relevance_score: number;
  source_file: string;
  original_date: string | null;
  created_at: string;
  chunk_id: string;
  file_id: number;
  insight_type: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic');
    const date = searchParams.get('date');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({
        snippets: generateMockSnippets(topic, date),
        total: 25,
        isDemo: true
      });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Build the query based on filters
    let query = supabase
      .from('llm_insights')
      .select(`
        id,
        content,
        insight_type,
        metadata,
        created_at,
        relevance_score:score
      `);

    // Filter by topic (insight_type)
    if (topic) {
      const topicMap: { [key: string]: string[] } = {
        'Pain Points': ['pain_points_quote', 'pain_points_summary'],
        'Blockers': ['blockers_quote', 'blockers_summary'],
        'Customer Requests': ['customer_requests_quote', 'customer_requests_summary'],
        'Solution Feedback': ['solution_feedback_quote', 'solution_feedback_summary']
      };
      
      const insightTypes = topicMap[topic];
      if (insightTypes) {
        query = query.in('insight_type', insightTypes);
      }
    }

    // Add text search if provided
    if (search) {
      query = query.ilike('content', `%${search}%`);
    }

    // Execute the main query with pagination
    const { data: insights, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
      .limit(limit);

    if (error) {
      console.error('Error fetching filtered snippets:', error);
      return NextResponse.json({
        snippets: generateMockSnippets(topic, date),
        total: 25,
        isDemo: true
      });
    }

    if (!insights || insights.length === 0) {
      return NextResponse.json({
        snippets: [],
        total: 0,
        isDemo: false
      });
    }

    // Get chunk and file information for each insight
    const snippetsWithContext = await Promise.all(
      insights.map(async (insight) => {
        const metadata = insight.metadata as { chunk_id?: string } || {};
        let chunkInfo = null;
        let fileInfo = null;

        if (metadata.chunk_id) {
          // Get chunk information including original_date
          const { data: chunkData } = await supabase
            .from('file_chunks')
            .select(`
              id,
              original_date,
              file_id,
              uploaded_files(name, document_type)
            `)
            .eq('id', metadata.chunk_id)
            .single();
          
          chunkInfo = chunkData;
          fileInfo = Array.isArray(chunkData?.uploaded_files) && chunkData.uploaded_files.length > 0 
            ? chunkData.uploaded_files[0] as { name: string; document_type: string }
            : null;
        }

        // Filter by date if provided
        if (date && chunkInfo?.original_date) {
          const snippetDate = new Date(chunkInfo.original_date).toISOString().split('T')[0];
          if (snippetDate !== date) {
            return null; // Filter out this snippet
          }
        }

        return {
          id: insight.id,
          text: insight.content,
          topic: getTopicFromInsightType(insight.insight_type),
          relevance_score: insight.relevance_score || 0,
          source_file: fileInfo?.name || 'Unknown Source',
          original_date: chunkInfo?.original_date || null,
          created_at: insight.created_at,
          chunk_id: metadata.chunk_id || '',
          file_id: chunkInfo?.file_id || 0,
          insight_type: insight.insight_type
        };
      })
    );

    // Filter out null results (date mismatches)
    const filteredSnippets = snippetsWithContext.filter(Boolean) as FilteredSnippet[];

    return NextResponse.json({
      snippets: filteredSnippets,
      total: filteredSnippets.length,
      isDemo: false,
      filters: {
        topic,
        date,
        search
      }
    });

  } catch (error) {
    console.error('Failed to fetch filtered snippets:', error);
    const { searchParams } = new URL(req.url);
    const catchTopic = searchParams.get('topic');
    const catchDate = searchParams.get('date');
    
    return NextResponse.json({
      snippets: generateMockSnippets(catchTopic, catchDate),
      total: 25,
      isDemo: true
    });
  }
}

function getTopicFromInsightType(insightType: string): string {
  if (insightType.includes('pain_points')) return 'Pain Points';
  if (insightType.includes('blockers')) return 'Blockers';
  if (insightType.includes('customer_requests')) return 'Customer Requests';
  if (insightType.includes('solution_feedback')) return 'Solution Feedback';
  return 'Other';
}

function generateMockSnippets(topic?: string | null, date?: string | null): FilteredSnippet[] {
  const mockSnippets = [
    {
      id: '1',
      text: 'The current checkout process is too complicated and confusing for our customers.',
      topic: 'Pain Points',
      relevance_score: 0.85,
      source_file: 'Customer Survey Q2 2024',
      original_date: '2024-06-15',
      created_at: '2024-06-16T10:00:00Z',
      chunk_id: 'chunk_1',
      file_id: 1,
      insight_type: 'pain_points_quote'
    },
    {
      id: '2', 
      text: 'Users are requesting a mobile app version of our platform.',
      topic: 'Customer Requests',
      relevance_score: 0.92,
      source_file: 'User Interview Notes',
      original_date: '2024-06-20',
      created_at: '2024-06-21T14:30:00Z',
      chunk_id: 'chunk_2',
      file_id: 2,
      insight_type: 'customer_requests_quote'
    },
    {
      id: '3',
      text: 'The API rate limiting is preventing our integration from working properly.',
      topic: 'Blockers',
      relevance_score: 0.78,
      source_file: 'Support Tickets June',
      original_date: '2024-06-10',
      created_at: '2024-06-11T09:15:00Z',
      chunk_id: 'chunk_3',
      file_id: 3,
      insight_type: 'blockers_quote'
    },
    {
      id: '4',
      text: 'The new dashboard design is much more intuitive and easier to navigate.',
      topic: 'Solution Feedback',
      relevance_score: 0.88,
      source_file: 'Beta User Feedback',
      original_date: '2024-06-25',
      created_at: '2024-06-26T16:45:00Z',
      chunk_id: 'chunk_4',
      file_id: 4,
      insight_type: 'solution_feedback_quote'
    }
  ];

  // Filter by topic if provided
  const filteredByTopic = topic 
    ? mockSnippets.filter(snippet => snippet.topic === topic)
    : mockSnippets;

  // Filter by date if provided
  const filteredByDate = date
    ? filteredByTopic.filter(snippet => 
        snippet.original_date && new Date(snippet.original_date).toISOString().split('T')[0] === date
      )
    : filteredByTopic;

  return filteredByDate;
}