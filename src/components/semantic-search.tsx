import { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';

// TODO: Replace with real embedding API (Claude/OpenAI)
async function embedQuery(text: string): Promise<number[]> {
  // Placeholder: returns a random vector
  void text; // avoid unused param warning
  return Array(1536).fill(0).map(() => Math.random());
}

type SearchResult = {
  text: string;
  metadata: any;
  similarity?: number;
};

export function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const embedding = await embedQuery(query);
      const res = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'query', embedding, topK: 5 }),
      });
      const json = await res.json();
      if (json.results) setResults(json.results);
      else setError(json.error || 'No results');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-xl shadow flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Semantic Search</h2>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search feedback by meaning..."
          className="flex-1"
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
        />
        <Button onClick={handleSearch} disabled={loading || !query.trim()}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="space-y-3">
        {results.length > 0 && results.map((row, i) => (
          <div key={i} className="p-3 bg-slate-50 rounded border border-slate-200">
            <div className="text-slate-700 text-sm mb-1">{row.text}</div>
            <pre className="text-xs text-slate-500 whitespace-pre-wrap">{JSON.stringify(row.metadata, null, 2)}</pre>
            <div className="text-xs text-slate-400 mt-1">Similarity: {row.similarity?.toFixed(3)}</div>
          </div>
        ))}
      </div>
    </div>
  );
} 