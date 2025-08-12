/* Cleaned up dashboard widgets */
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCustomerData } from '@/hooks/useCustomerData';
import { useEffect, useState } from 'react';
import { Users, MessageSquare } from 'lucide-react';
import { Badge } from './ui/badge';
import { Cell, Tooltip, ResponsiveContainer, PieChart, Pie, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { getTopicChartColor } from '@/utils/topicUtils';

// Interface moved to contexts/CustomerDataContext.tsx

// Topic Analysis Widget - Chart showing topic frequency
interface TopicAnalysisWidgetProps {
  onSliceClick?: (topic: string) => void;
}

export function TopicAnalysisWidget({ onSliceClick }: TopicAnalysisWidgetProps = {}) {
  const [chartData, setChartData] = useState<Array<{name: string, value: number}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const fetchData = () => {
    setIsLoading(true);
    setHasError(null);
    
    fetch('/api/llm/unified-topic-analysis')
      .then(res => res.json())
      .then(json => {
        setChartData(Array.isArray(json.chartData) ? json.chartData : []);
        setIsDemo(!!json.isDemo);
        setIsLoading(false);
      })
      .catch((error) => {
        console.log('Failed to load topic analysis data:', error);
        setHasError('Failed to load topic analysis');
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchData();

    // Listen for analysis completion to refresh data
    const handleAnalysisComplete = (event: CustomEvent) => {
      if (event.detail?.chartData) {
        setChartData(event.detail.chartData);
        setIsDemo(false);
        setIsLoading(false);
      } else {
        fetchData();
      }
    };

    window.addEventListener('topicAnalysisComplete', handleAnalysisComplete as EventListener);

    return () => {
      window.removeEventListener('topicAnalysisComplete', handleAnalysisComplete as EventListener);
    };
  }, []);

  if (isLoading) {
    return (
      <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-500" />
            Snippets by Topic
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-500 text-sm">Loading topic analysis...</div>
        </CardContent>
      </Card>
    );
  }

  if (hasError) {
    return (
      <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-500" />
            Snippets by Topic
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-sm">{hasError}</div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-500" />
            Snippets by Topic
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-500 text-sm">No topic data available</div>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-500" />
          Snippets by Topic
          {isDemo && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
              Demo Data
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={hoveredSlice ? 95 : 90}
                  innerRadius={30}
                  label={false}
                  onClick={(data) => onSliceClick?.(data.name)}
                  onMouseEnter={(data) => setHoveredSlice(data.name)}
                  onMouseLeave={() => setHoveredSlice(null)}
                  className="cursor-pointer"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getTopicChartColor(entry.name)}
                      stroke={hoveredSlice === entry.name ? '#374151' : 'transparent'}
                      strokeWidth={hoveredSlice === entry.name ? 2 : 0}
                      style={{
                        filter: hoveredSlice === entry.name ? 'brightness(1.1)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ 
                    background: 'white', 
                    borderRadius: 8, 
                    border: '1px solid #e2e8f0',
                    fontSize: 14 
                  }}
                  formatter={(value: number) => [value, 'Snippets']}
                  labelFormatter={(label: string) => onSliceClick ? `${label} (click to view details)` : label}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Summary Stats Widget - Shows total snippets and topic categories
export function SummaryStatsWidget() {
  const [stats, setStats] = useState<{totalSnippets: number, totalCategories: number}>({
    totalSnippets: 0,
    totalCategories: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const fetchStats = () => {
    setIsLoading(true);
    setHasError(null);
    
    fetch('/api/llm/unified-topic-analysis')
      .then(res => res.json())
      .then(json => {
        const totalSnippets = Array.isArray(json.chartData) ? json.chartData.reduce((sum: number, item: {name: string, value: number}) => sum + item.value, 0) : 0;
        const totalCategories = Array.isArray(json.chartData) ? json.chartData.length : 0;
        setStats({ totalSnippets, totalCategories });
        setIsDemo(!!json.isDemo);
        setIsLoading(false);
      })
      .catch((error) => {
        console.log('Failed to load stats:', error);
        setHasError('Failed to load stats');
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchStats();

    // Listen for analysis completion
    const handleAnalysisComplete = (event: CustomEvent) => {
      if (event.detail?.chartData) {
        const totalSnippets = event.detail.chartData.reduce((sum: number, item: {name: string, value: number}) => sum + item.value, 0);
        const totalCategories = event.detail.chartData.length;
        setStats({ totalSnippets, totalCategories });
        setIsDemo(false);
        setIsLoading(false);
      } else {
        fetchStats();
      }
    };

    window.addEventListener('topicAnalysisComplete', handleAnalysisComplete as EventListener);

    return () => {
      window.removeEventListener('topicAnalysisComplete', handleAnalysisComplete as EventListener);
    };
  }, []);

  if (isLoading) {
    return (
      <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-500" />
            Summary Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-500 text-sm">Loading stats...</div>
        </CardContent>
      </Card>
    );
  }

  if (hasError) {
    return (
      <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-500" />
            Summary Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-sm">{hasError}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-500" />
          Summary Stats
          {isDemo && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
              Demo Data
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-700 mb-2">{stats.totalSnippets}</div>
            <div className="text-sm text-slate-600">Total Snippets</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-700 mb-2">{stats.totalCategories}</div>
            <div className="text-sm text-slate-600">Topic Categories</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Snippets Timeline Widget - Shows snippet counts over time by topic (stacked bar chart)
interface SnippetsTimelineWidgetProps {
  onBarClick?: (date: string, topic?: string) => void;
}

export function SnippetsTimelineWidget({ onBarClick }: SnippetsTimelineWidgetProps = {}) {
  const [timelineData, setTimelineData] = useState<Array<{
    date: string;
    'Pain Points': number;
    'Blockers': number;
    'Customer Requests': number;
    'Solution Feedback': number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const fetchTimelineData = async () => {
    setIsLoading(true);
    setHasError(null);
    
    try {
      const response = await fetch('/api/snippets-timeline');
      const json = await response.json();
      setTimelineData(Array.isArray(json.timelineData) ? json.timelineData : []);
      setIsDemo(!!json.isDemo);
      setIsLoading(false);
    } catch (error) {
      console.log('Failed to load timeline data:', error);
      setHasError('Failed to load timeline data');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTimelineData();

    // Listen for analysis completion
    const handleAnalysisComplete = () => {
      fetchTimelineData();
    };

    window.addEventListener('topicAnalysisComplete', handleAnalysisComplete as EventListener);

    return () => {
      window.removeEventListener('topicAnalysisComplete', handleAnalysisComplete as EventListener);
    };
  }, []);

  if (isLoading) {
    return (
      <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-500" />
            Snippets Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-500 text-sm">Loading timeline data...</div>
        </CardContent>
      </Card>
    );
  }

  if (hasError) {
    return (
      <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-500" />
            Snippets Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-sm">{hasError}</div>
        </CardContent>
      </Card>
    );
  }

  if (timelineData.length === 0) {
    return (
      <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-500" />
            Snippets Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-500 text-sm">No timeline data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-indigo-500" />
          Snippets Over Time
          {isDemo && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
              Demo Data
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={timelineData} 
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              onClick={(data) => {
                if (data && data.activeLabel) {
                  onBarClick?.(data.activeLabel);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ 
                  background: 'white', 
                  borderRadius: 8, 
                  border: '1px solid #e2e8f0',
                  fontSize: 14 
                }}
                labelFormatter={(value) => {
                  const date = new Date(value);
                  const formattedDate = date.toLocaleDateString('en-US', { 
                    weekday: 'short',
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  });
                  return onBarClick ? `${formattedDate} (click to view details)` : formattedDate;
                }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar 
                dataKey="Pain Points" 
                stackId="a" 
                fill="#ef4444"
                className="cursor-pointer"
              />
              <Bar 
                dataKey="Blockers" 
                stackId="a" 
                fill="#f97316"
                className="cursor-pointer"
              />
              <Bar 
                dataKey="Customer Requests" 
                stackId="a" 
                fill="#3b82f6"
                className="cursor-pointer"
              />
              <Bar 
                dataKey="Solution Feedback" 
                stackId="a" 
                fill="#10b981"
                className="cursor-pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// Source Breakdown Widget - Shows data source statistics
export function SourceBreakdownWidget() {
  const { data } = useCustomerData();
  
  if (!data.length) {
    return (
      <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-500" />
            Data Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-500 text-sm">No data available</div>
        </CardContent>
      </Card>
    );
  }

  // Group by fileName from the fields
  const sourceCount = data.reduce((acc, row) => {
    const fileName = row.fields.fileName || 'Unknown Source';
    acc[fileName] = (acc[fileName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sources = Object.entries(sourceCount).map(([name, count]) => ({
    name: name.replace(/\.(csv|xlsx|pdf)$/i, ''), // Remove file extension
    count
  }));

  const totalRows = data.length;

  return (
    <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
          <Users className="h-5 w-5 text-green-500" />
          Data Sources
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700">{totalRows}</div>
              <div className="text-sm text-slate-600">Total Records</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700">{sources.length}</div>
              <div className="text-sm text-slate-600">Data Sources</div>
            </div>
          </div>
          
          <div className="space-y-2">
            {sources.map((source, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-white/60 rounded-lg">
                <span className="text-sm font-medium text-slate-700 truncate flex-1 mr-2">
                  {source.name}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {source.count} records
                  </Badge>
                  <div className="text-xs text-slate-500">
                    {Math.round((source.count / totalRows) * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}