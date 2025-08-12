#!/usr/bin/env node

/**
 * Propagate extracted dates to all chunks within the same file
 * Perfect for meeting notes, interviews, and single-event documents
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

  console.log('🔄 Starting date propagation within files...');

  try {
    // Get all chunks grouped by file
    const { data: chunks, error } = await supabase
      .from('file_chunks')
      .select(`
        id,
        file_id,
        chunk_index,
        original_date,
        uploaded_files!inner(name, type)
      `)
      .order('file_id')
      .order('chunk_index');

    if (error) {
      console.error('❌ Failed to fetch chunks:', error);
      process.exit(1);
    }

    // Group by file and identify propagation candidates
    const fileGroups = new Map();
    
    chunks.forEach(chunk => {
      const fileId = chunk.file_id;
      if (!fileGroups.has(fileId)) {
        fileGroups.set(fileId, {
          name: chunk.uploaded_files.name,
          type: chunk.uploaded_files.type,
          chunks: []
        });
      }
      fileGroups.get(fileId).chunks.push(chunk);
    });

    let totalUpdated = 0;
    let filesProcessed = 0;

    for (const [fileId, fileGroup] of fileGroups.entries()) {
      const chunks = fileGroup.chunks;
      
      // Find chunks with dates and chunks without dates
      const chunksWithDates = chunks.filter(c => c.original_date);
      const chunksWithoutDates = chunks.filter(c => !c.original_date);
      
      // Skip if no propagation needed
      if (chunksWithoutDates.length === 0) {
        continue;
      }
      
      // Skip if no dates to propagate from
      if (chunksWithDates.length === 0) {
        continue;
      }
      
      // Get the most common date (in case of inconsistencies)
      const dateCounts = new Map();
      chunksWithDates.forEach(chunk => {
        const dateOnly = chunk.original_date.split('T')[0]; // Just date part
        dateCounts.set(dateOnly, (dateCounts.get(dateOnly) || 0) + 1);
      });
      
      // Find the most frequent date
      let mostCommonDate = null;
      let maxCount = 0;
      for (const [date, count] of dateCounts.entries()) {
        if (count > maxCount) {
          mostCommonDate = date;
          maxCount = count;
        }
      }
      
      if (!mostCommonDate) {
        continue;
      }
      
      // Convert back to full timestamp format (assuming start of day)
      const propagationDate = `${mostCommonDate}T00:00:00+00:00`;
      
      console.log(`\n📋 Processing: ${fileGroup.name}`);
      console.log(`   Propagating date ${mostCommonDate} to ${chunksWithoutDates.length} chunks`);
      
      // Update chunks without dates
      let fileUpdates = 0;
      for (const chunk of chunksWithoutDates) {
        const { error: updateError } = await supabase
          .from('file_chunks')
          .update({ original_date: propagationDate })
          .eq('id', chunk.id);
          
        if (updateError) {
          console.log(`   ❌ Failed to update chunk ${chunk.chunk_index}: ${updateError.message}`);
        } else {
          fileUpdates++;
          totalUpdated++;
          console.log(`   ✅ Updated chunk ${chunk.chunk_index}`);
        }
      }
      
      if (fileUpdates > 0) {
        filesProcessed++;
        console.log(`   📊 Updated ${fileUpdates}/${chunksWithoutDates.length} chunks in this file`);
      }
    }

    console.log(`\n🎉 Date propagation completed!`);
    console.log(`📈 Results:`);
    console.log(`  Files processed: ${filesProcessed}`);
    console.log(`  Total chunks updated: ${totalUpdated}`);

    // Show updated progress
    const { count: totalChunks } = await supabase
      .from('file_chunks')
      .select('*', { count: 'exact', head: true });

    const { count: chunksWithDates } = await supabase
      .from('file_chunks')
      .select('*', { count: 'exact', head: true })
      .not('original_date', 'is', null);

    const newProgress = totalChunks ? Math.round(((chunksWithDates || 0) / totalChunks) * 100) : 0;
    
    console.log(`\n📊 New overall progress:`);
    console.log(`  Total chunks: ${totalChunks || 0}`);
    console.log(`  With dates: ${chunksWithDates || 0}`);
    console.log(`  Progress: ${newProgress}%`);

  } catch (error) {
    console.error('❌ Date propagation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}