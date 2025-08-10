'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from './ui/badge';
import { InteractiveQuote } from './interactive-quote';
import { getTopicColor, getTopicIcon } from '@/utils/topicUtils';

interface GroupedInsight {
  insight_statement: string;
  quotes: Array<{
    text: string;
    chunk_id: string;
    relevance: number;
    source?: string;
  }>;
  recommendations: string[];
}

interface TopicInsightGrouped {
  topic: string;
  summary: string;
  grouped_insights: GroupedInsight[];
  recommendations: string[];
  total_mentions: number;
}


export function GroupedTopicInsightsWidget() {
  const [data, setData] = useState<TopicInsightGrouped[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());

  const fetchData = () => {
    setIsLoading(true);
    setHasError(null);
    console.log('GroupedTopicInsightsWidget fetchData called');
    
    // First try to load stored insights
    fetch('/api/llm/stored-grouped-insights')
      .then(res => res.json())
      .then(json => {
        console.log('GroupedTopicInsightsWidget stored insights response:', json);
        if (json.insights && json.insights.length > 0) {
          setData(json.insights);
          setIsDemo(!!json.isDemo);
          setIsLoading(false);
        } else {
          console.log('No stored insights found, generating new ones...');
          // If no stored insights, generate new ones
          return fetch('/api/llm/grouped-insights');
        }
      })
      .then(res => {
        if (res) {
          return res.json();
        }
        return null;
      })
      .then(json => {
        if (json) {
          console.log('GroupedTopicInsightsWidget generated insights response:', json);
          setData(Array.isArray(json.insights) ? json.insights : []);
          setIsDemo(!!json.isDemo);
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.log('Failed to load grouped insights data:', error);
        setHasError('Failed to load topic insights');
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchData();

    // Listen for analysis completion to regenerate grouped insights
    const handleAnalysisComplete = (event: CustomEvent) => {
      console.log('GroupedTopicInsightsWidget received completion event:', event.detail);
      
      // Force regeneration of grouped insights when new analysis is done
      setIsLoading(true);
      fetch('/api/llm/grouped-insights')
        .then(res => res.json())
        .then(json => {
          console.log('GroupedTopicInsightsWidget regenerated insights:', json);
          setData(Array.isArray(json.insights) ? json.insights : []);
          setIsDemo(!!json.isDemo);
          setIsLoading(false);
        })
        .catch((error) => {
          console.log('Failed to regenerate grouped insights:', error);
          setHasError('Failed to load topic insights');
          setIsLoading(false);
        });
    };

    window.addEventListener('topicAnalysisComplete', handleAnalysisComplete as EventListener);

    return () => {
      window.removeEventListener('topicAnalysisComplete', handleAnalysisComplete as EventListener);
    };
  }, []);

  // Moved to utils/topicUtils.ts

  const toggleTopicExpansion = (topic: string) => {
    setExpandedTopics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(topic)) {
        newSet.delete(topic);
      } else {
        newSet.add(topic);
      }
      return newSet;
    });
  };

  const toggleInsightExpansion = (insightKey: string) => {
    setExpandedInsights(prev => {
      const newSet = new Set(prev);
      if (newSet.has(insightKey)) {
        newSet.delete(insightKey);
      } else {
        newSet.add(insightKey);
      }
      return newSet;
    });
  };

  // Moved to utils/topicUtils.ts

  const getTotalQuotes = (insights: GroupedInsight[]) => {
    return insights.reduce((total, insight) => total + insight.quotes.length, 0);
  };

  if (isLoading) {
    return (
      <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-500" />
            Customer Feedback Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-500 text-sm">Loading customer insights...</div>
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
            Customer Feedback Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-sm">{hasError}</div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-slate-500" />
            Customer Feedback Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-500 text-sm">No customer insights available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium text-slate-700 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-indigo-500" />
          Customer Feedback Insights
          {isDemo && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
              Demo Data
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((topicData, topicIndex) => (
            <div key={topicIndex} className={`p-4 border rounded-lg ${getTopicColor(topicData.topic)}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getTopicIcon(topicData.topic)}</span>
                  <h3 className="font-semibold text-slate-800">{topicData.topic}</h3>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {getTotalQuotes(topicData.grouped_insights)} mentions
                </Badge>
              </div>
              
              <p className="text-sm text-slate-700 mb-4 italic">{topicData.summary}</p>
              
              <div className="space-y-4">
                {/* Grouped Insights Section */}
                {topicData.grouped_insights.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                        Key Insights:
                      </h4>
                      {getTotalQuotes(topicData.grouped_insights) > 6 && (
                        <button
                          onClick={() => toggleTopicExpansion(topicData.topic)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium transition-colors"
                        >
                          {expandedTopics.has(topicData.topic) ? (
                            <>
                              Show Less <ChevronUp className="h-3 w-3" />
                            </>
                          ) : (
                            <>
                              Show all {getTotalQuotes(topicData.grouped_insights)} mentions <ChevronDown className="h-3 w-3" />
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {(() => {
                      const isTopicExpanded = expandedTopics.has(topicData.topic);
                      const insightsToShow = isTopicExpanded 
                        ? topicData.grouped_insights 
                        : topicData.grouped_insights.slice(0, 2);
                      
                      return insightsToShow.map((insight, insightIndex) => {
                        const insightKey = `${topicData.topic}-${insightIndex}`;
                        const isInsightExpanded = expandedInsights.has(insightKey);
                        const quotesToShow = isInsightExpanded ? insight.quotes : insight.quotes.slice(0, 2);
                        
                        return (
                          <div key={insightIndex} className="border border-slate-200 rounded-lg p-3 bg-white/60">
                            {/* Insight Statement */}
                            <div className="mb-2">
                              <div className="flex items-start gap-2">
                                <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0"></div>
                                <p className="text-sm font-medium text-slate-800 leading-relaxed">
                                  {insight.insight_statement}
                                </p>
                              </div>
                            </div>

                            {/* Supporting Quotes */}
                            <div className="ml-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 font-medium">
                                  Supporting quotes ({insight.quotes.length}):
                                </span>
                                {insight.quotes.length > 2 && (
                                  <button
                                    onClick={() => toggleInsightExpansion(insightKey)}
                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                                  >
                                    {isInsightExpanded ? (
                                      <>
                                        Show Less <ChevronUp className="h-3 w-3" />
                                      </>
                                    ) : (
                                      <>
                                        +{insight.quotes.length - 2} more <ChevronDown className="h-3 w-3" />
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                              {quotesToShow.map((quote, quoteIndex) => (
                                <div key={quoteIndex} className="pl-2 border-l-2 border-slate-200">
                                  <InteractiveQuote
                                    text={quote.text}
                                    chunkId={quote.chunk_id}
                                    relevance={quote.relevance}
                                    topic={topicData.topic}
                                    source={quote.source}
                                  />
                                </div>
                              ))}
                            </div>

                            {/* Group-level Recommendations */}
                            {insight.recommendations && insight.recommendations.length > 0 && (
                              <div className="ml-4 mt-3 pt-2 border-t border-slate-200">
                                <h5 className="text-xs font-medium text-slate-600 uppercase tracking-wide flex items-center gap-1 mb-2">
                                  <span>🎯</span> Recommendations for this insight:
                                </h5>
                                <div className="space-y-1">
                                  {insight.recommendations.map((recommendation, recIndex) => (
                                    <div key={recIndex} className="flex items-start gap-2">
                                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                                      <div className="text-xs text-slate-700 font-medium leading-relaxed">
                                        {recommendation}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-slate-600 text-center">
          Insights automatically grouped from customer feedback • Powered by AI analysis
        </div>
      </CardContent>
    </Card>
  );
}