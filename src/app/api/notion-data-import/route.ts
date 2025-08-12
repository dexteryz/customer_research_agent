import { NextRequest, NextResponse } from 'next/server';
import { transformNotionToFeedbackData } from '../../../utils/notion-data-transformer';
import { createClient } from '@supabase/supabase-js';
import { classifyDocumentType } from '@/utils/documentTypeClassifier';
import { batchExtractDatesWithLLM } from '@/utils/llmDateExtraction';

export async function POST(req: NextRequest) {
  try {
    console.log('Notion data import endpoint hit');
    
    // Accept various input formats:
    // 1. Raw array of objects
    // 2. Single object (convert to array)
    // 3. Wrapped in object with notionData key
    const requestBody = await req.json();
    let notionData;
    
    if (Array.isArray(requestBody)) {
      // Raw array format
      notionData = requestBody;
    } else if (requestBody.notionData && Array.isArray(requestBody.notionData)) {
      // Wrapped array format
      notionData = requestBody.notionData;
    } else if (typeof requestBody === 'object' && requestBody !== null) {
      // Single object format (new simplified format) - convert to array
      notionData = [requestBody];
    } else {
      notionData = null;
    }
    
    console.log('Request data:', { 
      inputType: Array.isArray(requestBody) ? 'array' : typeof requestBody,
      notionDataLength: notionData?.length,
      sampleItem: notionData?.[0] ? Object.keys(notionData[0]) : null
    });

    if (!Array.isArray(notionData)) {
      return NextResponse.json({ 
        error: 'Invalid data format',
        message: 'Expected an array of Notion meeting objects, a single object, or an object with notionData array',
        success: false,
        transformedData: []
      }, { status: 400 });
    }

    if (notionData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No data to process',
        transformedData: [],
        stats: {
          totalMeetings: 0,
          customerCalls: 0,
          uniqueAttendees: 0
        }
      });
    }

    // Transform Notion data to feedback format
    const transformedData = transformNotionToFeedbackData(notionData);
    console.log(`Transformed ${transformedData.length} customer calls from ${notionData.length} total meetings`);

    // Store data in Supabase if available
    let storedInDatabase = false;
    const analysisTriggered = false; // Analysis is now manual via Generate Summary button
    
    if (transformedData.length > 0 && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        // Create a file record for this import
        const fileName = `Notion Import ${new Date().toISOString()}`;
        const storagePath = `notion-imports/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9]/g, '-')}.json`;
        
        // Automatically classify as meeting notes
        const documentType = classifyDocumentType(fileName);
        console.log(`Classified Notion import "${fileName}" as: ${documentType}`);
        
        const { data: fileRecord, error: fileError } = await supabase
          .from('uploaded_files')
          .insert({
            name: fileName,
            storage_path: storagePath,
            size: JSON.stringify(transformedData).length,
            type: 'application/json',
            document_type: documentType,
            uploaded_at: new Date().toISOString()
          })
          .select()
          .single();

        if (fileError) {
          console.error('Error creating file record:', fileError);
        } else if (fileRecord) {
          console.log('Created file record:', fileRecord.id);
          storedInDatabase = true;

          // Insert transformed data as properly chunked content
          const chunks: Array<{
            file_id: number;
            chunk_index: number;
            content: string;
            created_at: string;
          }> = [];
          
          let chunkIndex = 0;
          
          // Break each meeting's content into smaller chunks (1000 chars per chunk, like file upload)
          for (const item of transformedData) {
            const contentChunks = item.content.match(/([\s\S]{1,1000})(?:\n|$)/g) || [item.content];
            
            for (const chunk of contentChunks) {
              chunks.push({
                file_id: fileRecord.id,
                chunk_index: chunkIndex,
                content: chunk,
                created_at: new Date().toISOString()
              });
              chunkIndex++;
            }
          }

          // Extract original dates from chunks using LLM
          console.log(`Extracting dates from ${chunks.length} Notion chunks...`);
          const chunkDateExtractions = await batchExtractDatesWithLLM(
            chunks.map((chunk, i) => ({ content: chunk.content, id: i.toString() })),
            fileName,
            2 // Small batch size for Notion imports
          );
          
          // Update chunks with extracted dates before inserting
          chunks.forEach((chunk, i) => {
            const extraction = chunkDateExtractions[i]?.extractedDate;
            if (extraction?.date) {
              (chunk as typeof chunk & { original_date?: string }).original_date = extraction.date;
              console.log(`Chunk ${i}: Extracted date ${extraction.date} (${extraction.confidence})`);
            }
          });

          const { error: chunksError } = await supabase
            .from('file_chunks')
            .insert(chunks);
            
          const datesExtracted = chunks.filter((chunk) => 'original_date' in chunk && chunk.original_date).length;
          console.log(`Inserted ${chunks.length} chunks with ${datesExtracted} dates extracted`);

          if (chunksError) {
            console.error('Error inserting chunks:', chunksError);
          } else {
            console.log(`Inserted ${chunks.length} content chunks from ${transformedData.length} meetings into database`);
            
            // Note: LLM analysis is now triggered manually via the Generate Summary button
            console.log('Data stored successfully - LLM analysis can be triggered manually via dashboard');
          }
        }
      } catch (dbError) {
        console.error('Database operation failed:', dbError);
      }
    }

    // Calculate stats
    const stats = {
      totalMeetings: notionData.length,
      customerCalls: transformedData.length,
      uniqueAttendees: transformedData.length > 0 
        ? Array.from(new Set(transformedData.flatMap(item => item.metadata.attendees))).length 
        : 0,
      dateRange: transformedData.length > 0 ? {
        earliest: new Date(Math.min(...transformedData.map(item => new Date(item.date).getTime()))).toISOString(),
        latest: new Date(Math.max(...transformedData.map(item => new Date(item.date).getTime()))).toISOString()
      } : null,
      storedInDatabase,
      analysisTriggered
    };

    return NextResponse.json({
      success: true,
      transformedData,
      stats,
      message: `Successfully processed ${stats.customerCalls} customer calls from ${stats.totalMeetings} total meetings${storedInDatabase ? ' and stored in database' : ''}. Use the Generate Summary button to analyze the data.`
    });

  } catch (error) {
    console.error('Error processing Notion data import:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to process Notion data',
      details: error instanceof Error ? error.message : 'Unknown error',
      transformedData: []
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Notion Data Import API - Transforms Notion meeting data to customer feedback format',
    usage: {
      endpoint: '/api/notion-data-import',
      method: 'POST',
      supported_formats: [
        {
          name: 'Simplified Format (New)',
          description: 'Direct key-value pairs - easiest to use',
          example: {
            'Name': 'Nathan Yu and Dexter Zhuang',
            'AI summary': 'Nathan and Dexter, both Dartmouth graduates, discuss their journeys...',
            'Event time': '2025-07-28T21:17:00.000Z',
            'Meeting Type': 'Customer Call',
            'Meeting Notes': 'Background & Connection\n\nBoth have a Dartmouth connection...'
          }
        },
        {
          name: 'Complex Format (Legacy)',
          description: 'Original Notion API format with properties_value structure',
          example: {
            id: 'notion-page-id',
            properties_value: {
              'Meeting Type': { name: 'Customer Call' },
              'AI summary': [{ plain_text: 'Meeting summary here...' }],
              'Meeting Notes': [{ plain_text: 'Full detailed meeting notes...' }],
              'Name': [{ plain_text: 'Meeting Name' }],
              'Event time': { start: '2024-01-01T10:00:00Z' },
              'Attendees': []
            }
          }
        }
      ],
      input_options: [
        'Single object (automatically converted to array)',
        'Array of objects',
        'Wrapped object: { "notionData": [...] }'
      ],
      supported_notes_properties: [
        'Meeting Notes', 'Notes', 'Full Notes', 'Meeting Content',
        'Content', 'Transcript', 'Full Meeting Notes', 'Body'
      ],
      note: 'The API now supports both simplified format (direct key-value pairs) and the original complex Notion format. Only Customer Call meetings with AI summaries are processed. Meeting Notes take priority over AI summaries for content.'
    }
  });
}