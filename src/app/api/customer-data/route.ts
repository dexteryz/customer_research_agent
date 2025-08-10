import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { mockCustomerData } from '@/data/mockData';

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
}

export async function GET(req: NextRequest) {
  // Check if environment variables are properly configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('Environment variables not configured, returning mock customer data');
    return NextResponse.json({ 
      data: [{
        name: 'Mock Customer Data',
        chunks: mockCustomerData
      }]
    });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  try {
    // Create Supabase client inside try block
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    // Fetch uploaded files
    const { data: files, error: filesError } = await supabase
      .from('uploaded_files')
      .select('*')
      .order('uploaded_at', { ascending: false });
    
    if (filesError) {
      return NextResponse.json({ error: 'Failed to fetch files', details: filesError.message }, { status: 500 });
    }
    
    let filteredFiles = files ?? [];
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      filteredFiles = filteredFiles.filter(f => {
        const uploaded = f.uploaded_at ? new Date(f.uploaded_at) : null;
        return uploaded && uploaded >= startDate && uploaded <= endDate;
      });
    }
    
    if (!filteredFiles.length) {
      return NextResponse.json({ data: [] });
    }
    
    // Fetch all file chunks for these files
    const fileIds = filteredFiles.map(f => f.id);
    const { data: chunks, error: chunksError } = await supabase
      .from('file_chunks')
      .select('*')
      .in('file_id', fileIds);
      
    if (chunksError) {
      return NextResponse.json({ error: 'Failed to fetch file chunks', details: chunksError.message }, { status: 500 });
    }
    
    // Structure: [{ file, chunks: [chunk, ...] }]
    const result = filteredFiles.map(file => ({
      ...file,
      chunks: (chunks ?? []).filter(chunk => chunk.file_id === file.id)
    }));
    
    return NextResponse.json({ data: result });
  } catch (error) {
    console.log('Supabase connection failed, returning mock customer data:', error);
    return NextResponse.json({ 
      data: [{
        name: 'Mock Customer Data',
        chunks: mockCustomerData
      }]
    });
  }
}

// Remove in-memory POST handler for MVP 