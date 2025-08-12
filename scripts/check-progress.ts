#!/usr/bin/env node

/**
 * Check progress of date extraction backfill
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ Supabase environment variables not found');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    // Get total chunks
    const { count: totalChunks } = await supabase
      .from('file_chunks')
      .select('*', { count: 'exact', head: true });

    // Get chunks with dates
    const { count: chunksWithDates } = await supabase
      .from('file_chunks')
      .select('*', { count: 'exact', head: true })
      .not('original_date', 'is', null);

    // Get chunks without dates
    const { count: chunksWithoutDates } = await supabase
      .from('file_chunks')
      .select('*', { count: 'exact', head: true })
      .is('original_date', null);

    // Get some examples of extracted dates
    const { data: examples } = await supabase
      .from('file_chunks')
      .select('id, chunk_index, original_date, uploaded_files!inner(name)')
      .not('original_date', 'is', null)
      .order('original_date', { ascending: false })
      .limit(10);

    console.log('📊 Date Extraction Progress Report');
    console.log('=====================================');
    console.log(`Total chunks: ${totalChunks || 0}`);
    console.log(`With dates: ${chunksWithDates || 0}`);
    console.log(`Without dates: ${chunksWithoutDates || 0}`);
    console.log(`Progress: ${totalChunks ? Math.round(((chunksWithDates || 0) / totalChunks) * 100) : 0}%`);
    
    if (examples && examples.length > 0) {
      console.log('\n🎯 Recent extracted dates:');
      examples.forEach(ex => {
        console.log(`  ${ex.original_date} - Chunk ${ex.chunk_index} from ${ex.uploaded_files.name}`);
      });
    }

  } catch (error) {
    console.error('❌ Failed to check progress:', error);
  }
}

if (require.main === module) {
  main();
}