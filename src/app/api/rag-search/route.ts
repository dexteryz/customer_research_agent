import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { query, topK = 5 } = await req.json();
  if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  // Embed the query
  const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
  const [queryEmbedding] = await embeddings.embedDocuments([query]);

  // Search chunk_embeddings table using pgvector similarity
  const { data: results, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    match_count: topK,
  });
  if (error) {
    return NextResponse.json({ error: 'Vector search failed', details: error.message }, { status: 500 });
  }

  // Each result should include chunk content and metadata
  // Synthesize answer using LangChain RAG chain
  interface ChunkResult {
    content?: string;
    chunk_content?: string;
    [key: string]: unknown;
  }
  const context = (results as ChunkResult[]).map(r => r.content || r.chunk_content || '').join('\n---\n');
  const prompt = new PromptTemplate({
    template: `You are a helpful assistant. Given the following context from uploaded files, answer the user's question as accurately as possible. If the answer is not in the context, say so.

Context:
{context}

Question: {question}

Answer:`,
    inputVariables: ['context', 'question'],
  });
  const llm = new ChatAnthropic({
    apiKey: process.env.CLAUDE_API_KEY!,
    model: 'claude-3-5-sonnet-20240620',
    temperature: 0,
    maxTokens: 512,
  });
  const chain = RunnableSequence.from([
    prompt,
    llm,
  ]);
  const answerResult = await chain.invoke({ context, question: query });
  const answer = typeof answerResult === 'string' ? answerResult : (answerResult.text || '');
  return NextResponse.json({ answer, results });
} 