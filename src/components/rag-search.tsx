import { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface ChunkResult {
  content?: string;
  chunk_content?: string;
  [key: string]: unknown;
}

export function RAGSearch() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setAnswer('');
    setSources([]);
    try {
      const res = await fetch('/api/rag-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (json.answer) setAnswer(json.answer);
      if (json.results) setSources((json.results as ChunkResult[]).map(r => r.content || r.chunk_content || ''));
      else setError(json.error || 'No results');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-xl shadow flex flex-col gap-4 mt-8">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Ask Your Data (RAG Search)</h2>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ask a question about your uploaded files..."
          className="flex-1"
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
        />
        <Button onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? 'Searching...' : 'Ask'}
        </Button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {answer && (
        <div className="bg-slate-50 rounded p-4 border border-slate-200">
          <div className="font-semibold mb-2 text-slate-700">Answer</div>
          <div className="text-slate-800 whitespace-pre-line">{answer}</div>
        </div>
      )}
      {sources.length > 0 && (
        <div className="bg-slate-50 rounded p-4 border border-slate-200 mt-2">
          <div className="font-semibold mb-2 text-slate-700">Source Chunks</div>
          <ul className="list-disc pl-5 space-y-2">
            {sources.map((src, i) => (
              <li key={i} className="text-slate-600 text-sm whitespace-pre-line">{src}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 