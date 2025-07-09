import { NextRequest, NextResponse } from 'next/server';
import { upsertFeedbackVector, queryFeedbackVector } from '@/lib/feedback-vector';

export async function POST(req: NextRequest) {
  try {
    const { mode, id, text, embedding, metadata, topK = 10 } = await req.json();
    if (!mode || !embedding || !Array.isArray(embedding)) {
      return NextResponse.json({ error: 'Missing mode or embedding' }, { status: 400 });
    }
    if (mode === 'upsert') {
      if (!text || !metadata) {
        return NextResponse.json({ error: 'Missing text or metadata for upsert' }, { status: 400 });
      }
      await upsertFeedbackVector({ id, text, embedding, metadata });
      return NextResponse.json({ success: true });
    } else if (mode === 'query') {
      const { data, error } = await queryFeedbackVector({ embedding, topK });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ results: data });
    } else {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Semantic search error', details: String(err) }, { status: 500 });
  }
} 