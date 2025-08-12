#!/usr/bin/env node

/**
 * TypeScript script to add document type classification and analyze existing files
 * This provides a programmatic way to manage document types
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface DocumentTypeMapping {
  [key: string]: string[];
}

// Document type classification patterns
const DOCUMENT_PATTERNS: DocumentTypeMapping = {
  'survey': [
    'survey', 'questionnaire', 'form', 'poll', 'quiz', 'assessment',
    'evaluation', 'grad', 'pledge', 'response', 'submission'
  ],
  'meeting_note': [
    'meeting', 'notes', 'notion', 'agenda', 'minutes', 'discussion',
    'brainstorm', 'planning', 'standup', 'sync', 'call'
  ],
  'interview': [
    'interview', 'conversation', 'q&a', 'one-on-one', '1-1', 
    'user research', 'customer interview'
  ],
  'transcript': [
    'transcript', 'recording', 'audio', 'video', 'call recording',
    'zoom', 'teams', 'webex'
  ],
  'feedback_form': [
    'feedback', 'review', 'rating', 'testimonial', 'comment',
    'suggestion', 'complaint', 'praise'
  ],
  'email': [
    'email', 'mail', 'inbox', 'message', 'correspondence',
    'communication', 'thread'
  ],
  'support_ticket': [
    'support', 'ticket', 'help', 'issue', 'bug', 'problem',
    'chat', 'live chat', 'helpdesk'
  ],
  'report': [
    'report', 'analysis', 'summary', 'insights', 'dashboard',
    'metrics', 'analytics', 'data'
  ]
};

function classifyDocumentType(filename: string): string {
  const lowerName = filename.toLowerCase();
  
  // Check each document type pattern
  for (const [docType, patterns] of Object.entries(DOCUMENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerName.includes(pattern)) {
        return docType;
      }
    }
  }
  
  return 'other';
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ Supabase environment variables not found');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log('🏷️  Starting document type classification...');

  try {
    // First, get all uploaded files
    const { data: files, error: fetchError } = await supabase
      .from('uploaded_files')
      .select('id, name, type, document_type, uploaded_at')
      .order('uploaded_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Failed to fetch files:', fetchError);
      process.exit(1);
    }

    if (!files || files.length === 0) {
      console.log('📁 No files found to classify');
      return;
    }

    console.log(`📊 Found ${files.length} files to analyze`);

    // Classify and update files
    let updated = 0;
    let alreadyClassified = 0;
    const classifications = new Map<string, string[]>();

    for (const file of files) {
      // Skip if already classified (unless you want to reclassify)
      if (file.document_type && file.document_type !== 'other') {
        alreadyClassified++;
        continue;
      }

      const detectedType = classifyDocumentType(file.name);
      
      // Update the database
      const { error: updateError } = await supabase
        .from('uploaded_files')
        .update({ document_type: detectedType })
        .eq('id', file.id);

      if (updateError) {
        console.error(`❌ Failed to update file ${file.id}:`, updateError);
      } else {
        updated++;
        
        // Track classifications for reporting
        if (!classifications.has(detectedType)) {
          classifications.set(detectedType, []);
        }
        classifications.get(detectedType)!.push(file.name);
        
        console.log(`  ✅ ${file.name} → ${detectedType}`);
      }
    }

    // Report results
    console.log(`\n🎉 Classification completed!`);
    console.log(`📈 Results:`);
    console.log(`  Files updated: ${updated}`);
    console.log(`  Already classified: ${alreadyClassified}`);
    console.log(`  Total files: ${files.length}`);

    // Show classification breakdown
    if (classifications.size > 0) {
      console.log(`\n📊 Document type breakdown:`);
      for (const [docType, fileNames] of classifications.entries()) {
        console.log(`  ${docType}: ${fileNames.length} files`);
        // Show first few examples
        const examples = fileNames.slice(0, 3);
        examples.forEach(name => console.log(`    - ${name}`));
        if (fileNames.length > 3) {
          console.log(`    ... and ${fileNames.length - 3} more`);
        }
        console.log();
      }
    }

    // Get overall statistics from database
    const { data: stats, error: statsError } = await supabase
      .from('uploaded_files')
      .select('document_type')
      .not('document_type', 'is', null);

    if (!statsError && stats) {
      const typeCounts = stats.reduce((acc, file) => {
        acc[file.document_type] = (acc[file.document_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log(`📋 Current document type distribution:`);
      Object.entries(typeCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${count} files`);
        });
    }

  } catch (error) {
    console.error('❌ Classification failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}