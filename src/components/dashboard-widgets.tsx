/* Dovetail-inspired dashboard widgets redesign */
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCustomerData } from '@/app/page';
import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Lightbulb, MessageSquare, Target, Users, BarChart3 } from 'lucide-react';
import { TagBadge } from './ui/tag-badge';
import { TagEditor } from './ui/tag-editor';
import { Badge } from './ui/badge';

interface CustomerFeedbackRow {
  fields: Record<string, string>;
  tags?: string[];
  category?: string;
}

function estimateSentiment(text: string): number {
  const pos = ["good", "great", "love", "excellent", "happy", "satisfied", "awesome", "positive", "amazing", "perfect"];
  const neg = ["bad", "poor", "hate", "terrible", "unhappy", "dissatisfied", "awful", "negative", "frustrated", "disappointed"];
  let score = 0;
  const lower = text.toLowerCase();
  pos.forEach(word => { if (lower.includes(word)) score += 1; });
  neg.forEach(word => { if (lower.includes(word)) score -= 1; });
  return score;
}

export function OverallSentimentWidget() {
  const { data } = useCustomerData();
  if (!data.length) {
    return (
      <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-500" />
            Sentiment Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-500 text-sm">No data available</div>
        </CardContent>
      </Card>
    );
  }
  let sum = 0;
  let count = 0;
  data.forEach(row => {
    const text = Object.values(row).join(" ");
    const sentiment = estimateSentiment(text);
    sum += sentiment;
    count += 1;
  });
  const avg = count ? sum / count : 0;
  const maxAbs = Math.max(Math.abs(avg), 1);
  const percentage = Math.abs(avg) / maxAbs * 100;
  const getSentimentColor = (score: number) => {
    if (score > 0.5) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score < -0.5) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-slate-600 bg-slate-50 border-slate-200';
  };
  const getSentimentIcon = (score: number) => {
    if (score > 0.5) return <TrendingUp className="h-4 w-4" />;
    if (score < -0.5) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };
  const getSentimentLabel = (score: number) => {
    if (score > 0.5) return 'Positive';
    if (score < -0.5) return 'Negative';
    return 'Neutral';
  };
  return (
    <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-slate-500" />
          Sentiment Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${getSentimentColor(avg)}`}>{getSentimentIcon(avg)}</div>
            <div>
              <div className="text-2xl font-semibold text-slate-800">{avg.toFixed(1)}</div>
              <div className="text-sm text-slate-600">{getSentimentLabel(avg)} sentiment</div>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">{data.length} responses</Badge>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Sentiment Score</span>
            <span>{percentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all duration-300 ${avg > 0 ? 'bg-emerald-500' : avg < 0 ? 'bg-red-500' : 'bg-slate-400'}`} style={{ width: `${percentage}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TopPainPointsWidget() {
  const { data } = useCustomerData();
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!data.length) return;
    setLoading(true);
    setError(null);
    fetch('/api/llm-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
      .then(res => res.json())
      .then(res => {
        setPainPoints(res.painPoints || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to analyze pain points.');
        setLoading(false);
      });
  }, [data]);
  return (
    <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
          <Target className="h-5 w-5 text-red-500" />
          Key Pain Points
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 text-slate-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
            <span className="text-sm">Analyzing feedback...</span>
          </div>
        )}
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">{error}</div>
        )}
        {!loading && !error && (
          <div className="space-y-3">
            {painPoints.length > 0 ? (
              painPoints.map((point, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-red-200">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-slate-700 leading-relaxed">{point}</p>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-sm text-center py-4">No pain points identified yet</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KeyQuotesWidget() {
  const { data } = useCustomerData();
  const [quotes, setQuotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!data.length) return;
    setLoading(true);
    setError(null);
    fetch('/api/llm-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
      .then(res => res.json())
      .then(res => {
        setQuotes(res.keyQuotes || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to extract key quotes.');
        setLoading(false);
      });
  }, [data]);
  return (
    <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-500" />
          Notable Quotes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 text-slate-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="text-sm">Extracting quotes...</span>
          </div>
        )}
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">{error}</div>
        )}
        {!loading && !error && (
          <div className="space-y-3">
            {quotes.length > 0 ? (
              quotes.map((quote, i) => (
                <div key={i} className="relative">
                  <div className="absolute left-0 top-0 w-1 h-full bg-blue-200 rounded-full"></div>
                  <blockquote className="pl-4 text-sm text-slate-700 italic leading-relaxed">&quot;{quote}&quot;</blockquote>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-sm text-center py-4">No notable quotes found</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SourceBreakdownWidget() {
  const { data } = useCustomerData();
  return (
    <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-500" />
          Data Sources
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
              <span className="text-sm font-medium text-slate-700">Uploaded Data</span>
            </div>
            <Badge variant="secondary" className="text-xs">{data.length} responses</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function HighlightsWidget() {
  const { data } = useCustomerData();
  const [highlights, setHighlights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!data.length) return;
    setLoading(true);
    setError(null);
    fetch('/api/llm-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, mode: 'highlights' }),
    })
      .then(res => res.json())
      .then(res => {
        setHighlights(res.highlights || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to generate highlights.');
        setLoading(false);
      });
  }, [data]);
  return (
    <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Key Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 text-slate-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500"></div>
            <span className="text-sm">Generating insights...</span>
          </div>
        )}
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">{error}</div>
        )}
        {!loading && !error && (
          <div className="space-y-3">
            {highlights.length > 0 ? (
              highlights.map((highlight, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-amber-200">
                  <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-slate-700 leading-relaxed">{highlight}</p>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-sm text-center py-4">No insights generated yet</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SuggestedImprovementsWidget() {
  const { data } = useCustomerData();
  const [improvements, setImprovements] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!data.length) return;
    setLoading(true);
    setError(null);
    fetch('/api/llm-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, mode: 'insights' }),
    })
      .then(res => res.json())
      .then(res => {
        setImprovements(res.actionableInsights || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to generate improvements.');
        setLoading(false);
      });
  }, [data]);
  return (
    <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-500" />
          Actionable Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 text-slate-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
            <span className="text-sm">Generating recommendations...</span>
          </div>
        )}
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">{error}</div>
        )}
        {!loading && !error && (
          <div className="space-y-3">
            {improvements.length > 0 ? (
              improvements.map((improvement, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-slate-700 leading-relaxed">{improvement}</p>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-sm text-center py-4">No recommendations generated yet</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecommendationsWidget() {
  const { data } = useCustomerData();
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!data.length) return;
    setLoading(true);
    setError(null);
    fetch('/api/llm-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, mode: 'insights' }),
    })
      .then(res => res.json())
      .then(res => {
        setRecommendations(res.recommendations || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to generate recommendations.');
        setLoading(false);
      });
  }, [data]);
  return (
    <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
          <Target className="h-5 w-5 text-purple-500" />
          Strategic Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 text-slate-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
            <span className="text-sm">Generating recommendations...</span>
          </div>
        )}
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">{error}</div>
        )}
        {!loading && !error && (
          <div className="space-y-3">
            {recommendations.length > 0 ? (
              recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-purple-200">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-slate-700 leading-relaxed">{rec}</p>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-sm text-center py-4">No strategic recommendations yet</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getCategoricalFields(data: Record<string, string>[]): string[] {
  if (!data.length) return [];
  const firstRow = data[0];
  return Object.keys(firstRow).filter(key => {
    const values = data.map(row => row[key]).filter(Boolean);
    const uniqueValues = new Set(values);
    return uniqueValues.size <= 10 && uniqueValues.size > 1;
  });
}

function getValueCounts(data: Record<string, string>[], key: string): [string, number][] {
  const counts = new Map<string, number>();
  data.forEach(row => {
    const value = row[key]?.trim();
    if (value) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

export function CustomerProfileBreakdownWidget() {
  const { data } = useCustomerData();
  const categoricalFields = useMemo(() => getCategoricalFields(data.map(row => row.fields)), [data]);
  if (!categoricalFields.length) {
    return (
      <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-500" />
            Customer Demographics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-500 text-sm">No categorical data available for breakdown</div>
        </CardContent>
      </Card>
    );
  }
  const topField = categoricalFields[0];
  const valueCounts = getValueCounts(data.map(row => row.fields), topField);
  return (
    <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-500" />
          Customer Demographics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm font-medium text-slate-600 mb-3">{topField} Breakdown</div>
          {valueCounts.slice(0, 5).map(([value, count], i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-indigo-200">
              <span className="text-sm text-slate-700">{value}</span>
              <Badge variant="secondary" className="text-xs">{count} ({((count / data.length) * 100).toFixed(0)}%)</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function FeedbackTable({ rows, onUpdate }: { rows: CustomerFeedbackRow[]; onUpdate?: (rows: CustomerFeedbackRow[]) => void }) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);

  function startEdit(idx: number, tags: string[] = []) {
    setEditingIdx(idx);
    setEditTags(tags);
  }
  function saveEdit(idx: number) {
    if (onUpdate) {
      const updated = rows.map((row, i) => i === idx ? { ...row, tags: editTags } : row);
      onUpdate(updated);
    }
    setEditingIdx(null);
  }

  if (!rows.length) return <div className="text-slate-500 text-sm">No feedback data available.</div>;
  // Get all field keys (excluding tags/category)
  const fieldKeys = Array.from(new Set(rows.flatMap(r => Object.keys(r.fields))));
  return (
    <div className="overflow-x-auto w-full">
      <table className="min-w-full border rounded-lg bg-white">
        <thead>
          <tr>
            {fieldKeys.map(key => (
              <th key={key} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 border-b">{key}</th>
            ))}
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 border-b">Tags</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 border-b">Category</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 border-b">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {fieldKeys.map(key => (
                <td key={key} className="px-3 py-2 text-sm text-slate-700">{row.fields[key] || ''}</td>
              ))}
              <td className="px-3 py-2">
                {editingIdx === i ? (
                  <TagEditor tags={editTags} onChange={setEditTags} />
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {(row.tags || []).map((tag: string) => <TagBadge key={tag} label={tag} />)}
                  </div>
                )}
              </td>
              <td className="px-3 py-2">
                {row.category ? <TagBadge label={row.category} colorClass="bg-blue-100 text-blue-800" /> : <span className="text-slate-400 text-xs">—</span>}
              </td>
              <td className="px-3 py-2">
                {editingIdx === i ? (
                  <button className="text-emerald-600 text-xs font-medium mr-2" onClick={() => saveEdit(i)}>Save</button>
                ) : (
                  <button className="text-blue-600 text-xs font-medium" onClick={() => startEdit(i, row.tags || [])}>Edit Tags</button>
                )}
                {editingIdx === i && (
                  <button className="text-slate-400 text-xs font-medium ml-2" onClick={() => setEditingIdx(null)}>Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 