import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import pdfParse from 'pdf-parse';
import { OpenAIEmbeddings } from '@langchain/openai';

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
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(fileName, file.stream(), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed', details: uploadError.message }, { status: 500 });
  }

  // Store metadata in DB (assumes a 'uploaded_files' table exists)
  const { data: metaData, error: metaError } = await supabase
    .from('uploaded_files')
    .insert([
      {
        name: file.name,
        storage_path: uploadData.path,
        type: file.type,
        size: file.size,
        uploaded_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();
  if (metaError) {
    return NextResponse.json({ error: 'Metadata insert failed', details: metaError.message }, { status: 500 });
  }

  // Download file from Supabase Storage for parsing
  const { data: fileData, error: downloadError } = await supabase.storage.from('uploads').download(uploadData.path);
  if (downloadError) {
    return NextResponse.json({ error: 'Download failed', details: downloadError.message }, { status: 500 });
  }

  // Parse file based on type
  let textContent = '';
  if (file.type === 'text/csv') {
    const csv = await fileData.text();
    const parsed = Papa.parse(csv, { header: false });
    textContent = parsed.data.flat().join('\n');
  } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    const arrayBuffer = await fileData.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    textContent = workbook.SheetNames.map(name => XLSX.utils.sheet_to_csv(workbook.Sheets[name])).join('\n');
  } else if (file.type === 'application/pdf') {
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const pdf = await pdfParse(buffer);
    textContent = pdf.text;
  } else if (file.type.startsWith('text/')) {
    textContent = await fileData.text();
  } else {
    textContent = '';
  }

  // Chunk text (simple split by paragraphs, 1000 chars per chunk)
  const chunks = textContent.match(/([\s\S]{1,1000})(?:\n|$)/g) || [];

  // Store chunks in 'file_chunks' table
  const chunkRows = chunks.map((chunk, i) => ({
    file_id: metaData.id,
    chunk_index: i,
    content: chunk,
    created_at: new Date().toISOString(),
  }));
  let insertedChunks = [];
  if (chunkRows.length > 0) {
    const { data: inserted, error: chunkInsertError } = await supabase.from('file_chunks').insert(chunkRows).select();
    if (chunkInsertError) {
      return NextResponse.json({ error: 'Chunk insert failed', details: chunkInsertError.message }, { status: 500 });
    }
    insertedChunks = inserted;
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

  return NextResponse.json({ file: metaData, chunks: insertedChunks.length, embedded: embeddedCount });
} 