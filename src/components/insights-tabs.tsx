'use client';

import { useState, useEffect } from 'react';
import { GroupedTopicInsightsWidget } from './grouped-topic-insights';
import { SnippetsTableView } from './snippets-table-view';
import { Filter } from 'lucide-react';

export interface InsightsTabsProps {
  initialTab?: 'insights' | 'snippets';
  initialFilters?: {
    topic?: string | null;
    date?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  };
}

export function InsightsTabs({ initialTab = 'insights', initialFilters }: InsightsTabsProps) {
  const [activeTab, setActiveTab] = useState<'insights' | 'snippets'>(initialTab);
  const [filters, setFilters] = useState(initialFilters || {});

  // Update tab when initialTab changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Update filters when initialFilters change
  useEffect(() => {
    setFilters(initialFilters || {});
  }, [initialFilters]);

  const handleTabChange = (tab: 'insights' | 'snippets') => {
    setActiveTab(tab);
  };

  const handleChartClick = (topic?: string, date?: string) => {
    // Set filters and switch to snippets tab
    setFilters({ topic: topic || null, date: date || null, startDate: null, endDate: null });
    setActiveTab('snippets');
  };

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-slate-200 mb-6">
        <button
          onClick={() => handleTabChange('insights')}
          className={`px-4 py-2 font-medium text-sm transition-colors duration-200 border-b-2 ${
            activeTab === 'insights'
              ? 'text-slate-900 border-slate-900'
              : 'text-slate-600 border-transparent hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          Insights by Topic
        </button>
        <button
          onClick={() => handleTabChange('snippets')}
          className={`px-4 py-2 font-medium text-sm transition-colors duration-200 border-b-2 ml-6 ${
            activeTab === 'snippets'
              ? 'text-slate-900 border-slate-900'
              : 'text-slate-600 border-transparent hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          Snippets
          {(filters.topic || filters.date || filters.startDate || filters.endDate) && (
            <span className="ml-2 inline-flex items-center text-xs text-blue-600" title="Filtered">
              <Filter className="h-3 w-3" />
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="w-full">
        {activeTab === 'insights' ? (
          <GroupedTopicInsightsWidget onChartClick={handleChartClick} />
        ) : (
          <SnippetsTableView 
            initialFilters={filters}
            onFiltersChange={setFilters}
          />
        )}
      </div>
    </div>
  );
}