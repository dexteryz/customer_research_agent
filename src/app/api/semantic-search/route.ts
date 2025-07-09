import { NextRequest, NextResponse } from 'next/server';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { OpenAIEmbeddings } from '@langchain/openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const vectorStore = new SupabaseVectorStore(
  new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }),
  { client: supabase, tableName: 'customer_feedback' }
);

export async function POST(req: NextRequest) {
  try {
    const { mode, id, text, embedding, metadata, topK = 10 } = await req.json();
    if (!mode) {
      return NextResponse.json({ error: 'Missing mode' }, { status: 400 });
    }
    if (mode === 'upsert') {
      if (!text || !embedding || !metadata) {
        return NextResponse.json({ error: 'Missing text, embedding, or metadata for upsert' }, { status: 400 });
      }
      await vectorStore.addDocuments([
        { pageContent: text, metadata: { ...metadata, id, embedding } }
      ]);
      return NextResponse.json({ success: true });
    } else if (mode === 'query') {
      if (!embedding) {
        return NextResponse.json({ error: 'Missing embedding for query' }, { status: 400 });
      }
      const results = await vectorStore.similaritySearchVectorWithScore(embedding, topK);
      return NextResponse.json({ results: results.map(([doc, score]) => ({ text: doc.pageContent, metadata: doc.metadata, similarity: score })) });
    } else {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Semantic search error', details: String(err) }, { status: 500 });
  }
} 