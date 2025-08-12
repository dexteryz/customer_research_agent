import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { OpenAIEmbeddings } from '@langchain/openai';
import { batchExtractDatesWithLLM } from '@/utils/llmDateExtraction';
import { classifyDocumentType } from '@/utils/documentTypeClassifier';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  // Upload to Supabase Storage
  const fileName = `${Date.now()}-${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed', details: uploadError.message, stack: uploadError.stack }, { status: 500 });
  }

  // Automatically classify document type based on filename
  const documentType = classifyDocumentType(file.name);
  console.log(`Classified "${file.name}" as: ${documentType}`);

  // Store metadata in DB (assumes a 'uploaded_files' table exists)
  const { data: metaData, error: metaError } = await supabase
    .from('uploaded_files')
    .insert([
      {
        name: file.name,
        storage_path: uploadData.path,
        type: file.type,
        size: file.size,
        document_type: documentType,
        uploaded_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();
  if (metaError) {
    return NextResponse.json({ error: 'Metadata insert failed', details: metaError.message, stack: metaError.stack }, { status: 500 });
  }

  // Download file from Supabase Storage for parsing
  const { data: fileData, error: downloadError } = await supabase.storage.from('uploads').download(uploadData.path);
  if (downloadError) {
    return NextResponse.json({ error: 'Download failed', details: downloadError.message, stack: downloadError.stack }, { status: 500 });
  }

  // Parse file based on type and preserve structure for better date extraction
  let textContent = '';
  let parsedData: Record<string, unknown>[] = [];
  let fileStructure: 'csv' | 'excel' | 'pdf' | 'text' | 'unknown' = 'unknown';

  if (file.type === 'text/csv') {
    const csv = await fileData.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    parsedData = parsed.data as Record<string, unknown>[];
    textContent = csv;
    fileStructure = 'csv';
  } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Extract structured data from Excel
    const allSheetData: Record<string, unknown>[] = [];
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
      allSheetData.push(...sheetData);
    }
    parsedData = allSheetData;
    
    textContent = workbook.SheetNames.map(name => XLSX.utils.sheet_to_csv(workbook.Sheets[name])).join('\n');
    fileStructure = 'excel';
  } else if (file.type === 'application/pdf') {
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const pdfParse = (await import('pdf-parse')).default;
    const pdf = await pdfParse(buffer);
    textContent = pdf.text;
    fileStructure = 'pdf';
  } else if (file.type.startsWith('text/')) {
    textContent = await fileData.text();
    fileStructure = 'text';
  } else {
    textContent = '';
  }

  // Chunk text with enhanced logic for structured data
  let chunks: string[] = [];
  
  if (fileStructure === 'csv' || fileStructure === 'excel') {
    // For structured data, create chunks per row/record when possible
    if (parsedData && parsedData.length > 0) {
      chunks = parsedData.map((row) => {
        if (typeof row === 'object') {
          // Convert object to readable text
          const rowText = Object.entries(row)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
          return rowText;
        } else {
          return String(row);
        }
      }).filter(chunk => chunk.trim().length > 0);
    }
    
    // Fallback to text chunking if structured parsing failed
    if (chunks.length === 0) {
      chunks = textContent.match(/([\s\S]{1,1000})(?:\n|$)/g) || [];
    }
  } else {
    // For unstructured data, use paragraph-based chunking
    chunks = textContent.match(/([\s\S]{1,1000})(?:\n|$)/g) || [];
  }

  // Extract original dates from chunks using LLM
  console.log(`Extracting dates from ${chunks.length} chunks using LLM...`);
  const chunkDateExtractions = await batchExtractDatesWithLLM(
    chunks.map((content, i) => ({ content, id: i.toString() })),
    file.name,
    2 // Smaller batch size for upload processing
  );
  
  // Store chunks in 'file_chunks' table with original dates
  const chunkRows = chunks.map((chunk, i) => {
    const extraction = chunkDateExtractions[i]?.extractedDate;
    const originalDate = extraction?.date || null;
    
    // Log successful extractions
    if (originalDate) {
      console.log(`Chunk ${i}: Extracted date ${originalDate} (${extraction.confidence} confidence - ${extraction.reasoning})`);
    }
    
    return {
      file_id: metaData.id,
      chunk_index: i,
      content: chunk,
      original_date: originalDate,
      created_at: new Date().toISOString(),
    };
  });
  let insertedChunks = [];
  if (chunkRows.length > 0) {
    try {
      const { data: inserted, error: chunkInsertError } = await supabase.from('file_chunks').insert(chunkRows).select();
      if (chunkInsertError) {
        console.error('Chunk insert failed:', {
          error: chunkInsertError,
          chunkRows,
          metaData,
        });
        return NextResponse.json({ error: 'Chunk insert failed', details: chunkInsertError.message, stack: chunkInsertError.stack }, { status: 500 });
      }
      insertedChunks = inserted;
    } catch (err) {
      const errorObj = err as Error;
      console.error('Exception during chunk insert:', errorObj, { chunkRows, metaData });
      return NextResponse.json({ error: 'Exception during chunk insert', details: errorObj.message, stack: errorObj.stack }, { status: 500 });
    }
  }

  // Embed chunks and store in chunk_embeddings table
  const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
  let embeddedCount = 0;
  for (let i = 0; i < insertedChunks.length; i++) {
    const chunk = insertedChunks[i];
    try {
      const [embedding] = await embeddings.embedDocuments([chunk.content]);
      await supabase.from('chunk_embeddings').insert({
        chunk_id: chunk.id,
        embedding,
        file_id: metaData.id,
        chunk_index: chunk.chunk_index,
      });
      embeddedCount++;
    } catch {}
  }

  // TODO: Trigger embedding step for these chunks
  // (This can be done in a background job or next API step)

  // Count successful date extractions
  const datesExtracted = chunkRows.filter(row => row.original_date).length;
  
  console.log(`Upload complete: ${insertedChunks.length} chunks, ${embeddedCount} embedded, ${datesExtracted} dates extracted, classified as ${documentType}`);
  
  return NextResponse.json({ 
    file: metaData, 
    chunks: insertedChunks.length, 
    embedded: embeddedCount,
    datesExtracted: datesExtracted,
    documentType: documentType,
    dateExtractionSummary: chunkDateExtractions
      .filter(extraction => extraction.extractedDate.date)
      .map(extraction => ({
        confidence: extraction.extractedDate.confidence,
        reasoning: extraction.extractedDate.reasoning,
        date: extraction.extractedDate.date
      }))
  });
} 