/* Cleaned up dashboard widgets */
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCustomerData } from '@/hooks/useCustomerData';
import { useEffect, useState } from 'react';
import { Users, MessageSquare } from 'lucide-react';
import { Badge } from './ui/badge';
import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getTopicChartColor } from '@/utils/topicUtils';

// Interface moved to contexts/CustomerDataContext.tsx

// Topic Analysis Widget - Chart showing topic frequency
export function TopicAnalysisWidget() {
  const [chartData, setChartData] = useState<Array<{name: string, value: number}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

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

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

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
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-700">{total}</div>
              <div className="text-sm text-slate-600">Total Snippets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-700">{chartData.length}</div>
              <div className="text-sm text-slate-600">Topic Categories</div>
            </div>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12, fill: '#475569' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{ 
                    background: 'white', 
                    borderRadius: 8, 
                    border: '1px solid #e2e8f0',
                    fontSize: 14 
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getTopicChartColor(entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
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