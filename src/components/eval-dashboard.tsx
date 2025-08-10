'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
// Using native HTML select for simplicity
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer, PieChart, Pie } from 'recharts';
import { CheckCircle, XCircle, TrendingUp, TrendingDown, Activity, Brain, Target, AlertTriangle, Filter, Search, Eye } from 'lucide-react';

interface Evaluation {
  id: string;
  insight_type: string;
  content: string;
  relevance: string;
  hallucination: string;
  evaluated_at: string;
  category: string;
}

interface EvalStats {
  status: string;
  worker_enabled: boolean;
  last_updated: string;
  totalInsights: number;
  evaluatedInsights: number;
  unevaluatedInsights: number;
  relevanceStats: {
    relevant: number;
    unrelated: number;
  };
  hallucinationStats: {
    factual: number;
    hallucinated: number;
  };
  byCategory: Record<string, {
    total: number;
    evaluated: number;
    relevant: number;
    factual: number;
    relevanceRate: number;
    factualRate: number;
  }>;
  performanceMetrics: {
    overallRelevanceRate: number;
    overallFactualRate: number;
    evaluationCoverage: number;
  };
  recentEvaluations: Evaluation[];
  allEvaluations?: Evaluation[];
}

// const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export function EvalDashboard() {
  const [data, setData] = useState<EvalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllEvaluations, setShowAllEvaluations] = useState(false);
  const [allEvaluations, setAllEvaluations] = useState<Evaluation[]>([]);
  const [filteredEvaluations, setFilteredEvaluations] = useState<Evaluation[]>([]);
  const [relevanceFilter, setRelevanceFilter] = useState<string>('all');
  const [qualityFilter, setQualityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const fetchEvalStats = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/eval-status');
        const result = await response.json();
        
        if (result.status === 'success') {
          setData(result);
          setError(null);
        } else {
          setError(result.message || 'Failed to load evaluation data');
        }
      } catch {
        setError('Failed to fetch evaluation statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvalStats();
  }, []);

  // Set all evaluations when data is loaded
  useEffect(() => {
    if (data && data.allEvaluations) {
      setAllEvaluations(data.allEvaluations);
      setFilteredEvaluations(data.allEvaluations);
    }
  }, [data]);

  // Filter evaluations based on current filters
  useEffect(() => {
    let filtered = allEvaluations;

    if (relevanceFilter !== 'all') {
      filtered = filtered.filter(ev => ev.relevance === relevanceFilter);
    }
    if (qualityFilter !== 'all') {
      filtered = filtered.filter(ev => ev.hallucination === qualityFilter);
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(ev => ev.category === categoryFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(ev => 
        ev.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredEvaluations(filtered);
  }, [allEvaluations, relevanceFilter, qualityFilter, categoryFilter, searchQuery]);

  // Handle showing all evaluations
  const handleShowAllEvaluations = () => {
    setShowAllEvaluations(!showAllEvaluations);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Evaluation Dashboard</h2>
        <div className="text-slate-500">Loading evaluation statistics...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800">Evaluation Dashboard</h2>
        <div className="text-red-600">Error: {error || 'No data available'}</div>
      </div>
    );
  }

  // Prepare chart data
  const categoryChartData = Object.entries(data.byCategory).map(([category, stats]) => ({
    name: category,
    total: stats.total,
    evaluated: stats.evaluated,
    relevant: stats.relevant,
    relevanceRate: stats.relevanceRate,
    factualRate: stats.factualRate
  }));

  const relevancePieData = [
    { name: 'Relevant', value: data.relevanceStats.relevant, color: '#10b981' },
    { name: 'Unrelated', value: data.relevanceStats.unrelated, color: '#ef4444' }
  ];

  const hallucinationPieData = [
    { name: 'Factual', value: data.hallucinationStats.factual, color: '#10b981' },
    { name: 'Hallucinated', value: data.hallucinationStats.hallucinated, color: '#f59e0b' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Evaluation Dashboard</h2>
        <div className="flex items-center gap-2">
          {data.worker_enabled ? (
            <Badge variant="secondary" className="text-green-600 border-green-200 bg-green-50">
              <Activity className="h-3 w-3 mr-1" />
              Worker Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-red-600 border-red-200 bg-red-50">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Worker Disabled
            </Badge>
          )}
          <div className="text-xs text-slate-500">
            Updated: {new Date(data.last_updated).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">Total Insights</p>
                <p className="text-2xl font-bold text-blue-900">{data.totalInsights}</p>
              </div>
              <Brain className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">Coverage</p>
                <p className="text-2xl font-bold text-green-900">{data.performanceMetrics.evaluationCoverage}%</p>
                <p className="text-xs text-green-700">{data.evaluatedInsights}/{data.totalInsights} evaluated</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-800">Relevance Rate</p>
                <p className="text-2xl font-bold text-purple-900">{data.performanceMetrics.overallRelevanceRate}%</p>
                <p className="text-xs text-purple-700">{data.relevanceStats.relevant} relevant</p>
              </div>
              {data.performanceMetrics.overallRelevanceRate >= 70 ? (
                <TrendingUp className="h-8 w-8 text-purple-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-purple-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-800">Factual Rate</p>
                <p className="text-2xl font-bold text-amber-900">{data.performanceMetrics.overallFactualRate}%</p>
                <p className="text-xs text-amber-700">{data.hallucinationStats.factual} factual</p>
              </div>
              {data.performanceMetrics.overallFactualRate >= 80 ? (
                <CheckCircle className="h-8 w-8 text-amber-500" />
              ) : (
                <XCircle className="h-8 w-8 text-amber-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-700">Evaluation Progress</span>
              <span className="text-slate-600">{data.evaluatedInsights} of {data.totalInsights} completed</span>
            </div>
            <Progress value={data.performanceMetrics.evaluationCoverage} className="h-2" />
            {data.unevaluatedInsights > 0 && (
              <p className="text-xs text-slate-600 mt-1">
                {data.unevaluatedInsights} insights pending evaluation
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Performance */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-800">Performance by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#334155' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#334155' }} />
                  <Tooltip
                    contentStyle={{ 
                      background: 'white', 
                      borderRadius: 8, 
                      border: '1px solid #e2e8f0',
                      fontSize: 14 
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'relevanceRate') return [`${value}%`, 'Relevance Rate'];
                      if (name === 'factualRate') return [`${value}%`, 'Factual Rate'];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="relevanceRate" name="Relevance Rate" fill="#10b981" />
                  <Bar dataKey="factualRate" name="Factual Rate" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Charts */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800">Relevance Distribution</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={relevancePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {relevancePieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {relevancePieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-slate-600">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800">Quality Distribution</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={hallucinationPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {hallucinationPieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {hallucinationPieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs text-slate-600">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Evaluations */}
      {data.recentEvaluations.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center justify-between">
              Recent Evaluations
              <Button
                onClick={handleShowAllEvaluations}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                {showAllEvaluations ? 'Show Summary' : 'View All'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showAllEvaluations ? (
              <div className="space-y-3">
                {data.recentEvaluations.slice(0, 8).map((evaluation) => (
                  <div key={evaluation.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">{evaluation.category}</Badge>
                        <Badge 
                          variant={evaluation.relevance === 'relevant' ? 'default' : 'secondary'}
                          className={`text-xs ${evaluation.relevance === 'relevant' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {evaluation.relevance}
                        </Badge>
                        <Badge 
                          variant={evaluation.hallucination === 'factual' ? 'default' : 'secondary'}
                          className={`text-xs ${evaluation.hallucination === 'factual' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}
                        >
                          {evaluation.hallucination}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-700">{evaluation.content}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(evaluation.evaluated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-medium text-slate-700">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search content..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-9"
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-medium text-slate-700">Relevance</label>
                    <select 
                      value={relevanceFilter} 
                      onChange={(e) => setRelevanceFilter(e.target.value)}
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All</option>
                      <option value="relevant">Relevant</option>
                      <option value="unrelated">Unrelated</option>
                    </select>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-medium text-slate-700">Quality</label>
                    <select 
                      value={qualityFilter} 
                      onChange={(e) => setQualityFilter(e.target.value)}
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All</option>
                      <option value="factual">Factual</option>
                      <option value="hallucinated">Hallucinated</option>
                    </select>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-medium text-slate-700">Category</label>
                    <select 
                      value={categoryFilter} 
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Categories</option>
                      <option value="Pain Points">Pain Points</option>
                      <option value="Blockers">Blockers</option>
                      <option value="Customer Requests">Customer Requests</option>
                      <option value="Solution Feedback">Solution Feedback</option>
                    </select>
                  </div>
                </div>

                {/* Results Count */}
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Filter className="h-4 w-4" />
                  Showing {filteredEvaluations.length} of {allEvaluations.length} evaluations
                </div>

                {/* All Evaluations Table */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredEvaluations.map((evaluation) => (
                    <div key={evaluation.id} className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs">{evaluation.category}</Badge>
                          <Badge 
                            variant={evaluation.relevance === 'relevant' ? 'default' : 'secondary'}
                            className={`text-xs ${evaluation.relevance === 'relevant' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                          >
                            {evaluation.relevance}
                          </Badge>
                          <Badge 
                            variant={evaluation.hallucination === 'factual' ? 'default' : 'secondary'}
                            className={`text-xs ${evaluation.hallucination === 'factual' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}
                          >
                            {evaluation.hallucination}
                          </Badge>
                          <div className="text-xs text-slate-500 ml-auto">
                            {new Date(evaluation.evaluated_at).toLocaleString()}
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{evaluation.content}</p>
                      </div>
                    </div>
                  ))}
                  
                  {filteredEvaluations.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      No evaluations match your current filters
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}