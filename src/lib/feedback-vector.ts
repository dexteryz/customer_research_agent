import { supabase } from './supabase';

export async function upsertFeedbackVector({
  id,
  text,
  embedding,
  metadata,
}: {
  id?: string;
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}) {
  return supabase.from('customer_feedback').upsert([
    { id, text, embedding, metadata }
  ]);
}

export async function queryFeedbackVector({
  embedding,
  topK = 10,
}: {
  embedding: number[];
  topK?: number;
}) {
  const { data, error } = await supabase.rpc('match_feedback', {
    query_embedding: embedding,
    match_count: topK,
  });
  return { data, error };
} 