'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Calendar, FileText, TrendingUp, X } from 'lucide-react';
import type { FilteredSnippet } from '@/app/api/filtered-snippets/route';
import { getTopicChartColor } from '@/utils/topicUtils';
import { InteractiveQuote } from './interactive-quote';

interface SnippetsTableViewProps {
  initialFilters?: {
    topic?: string | null;
    date?: string | null;
  };
  onFiltersChange?: (filters: { topic?: string | null; date?: string | null }) => void;
}

export function SnippetsTableView({ initialFilters, onFiltersChange }: SnippetsTableViewProps) {
  const [snippets, setSnippets] = useState<FilteredSnippet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [totalSnippets, setTotalSnippets] = useState(0);
  const [topicFilter, setTopicFilter] = useState<string | null>(initialFilters?.topic || null);
  const [dateFilter, setDateFilter] = useState<string | null>(initialFilters?.date || null);
  
  const ITEMS_PER_PAGE = 1000; // Show all snippets
  
  // Available topic options
  const topicOptions = ['Pain Points', 'Blockers', 'Customer Requests', 'Solution Feedback'];

  // Update filters when initialFilters change
  useEffect(() => {
    if (initialFilters?.topic !== topicFilter || initialFilters?.date !== dateFilter) {
      setTopicFilter(initialFilters?.topic || null);
      setDateFilter(initialFilters?.date || null);
      setSearchQuery('');
    }
  }, [initialFilters?.topic, initialFilters?.date, topicFilter, dateFilter]);

  const fetchSnippets = async (
    topic?: string | null, 
    date?: string | null, 
    search: string = '',
    page: number = 1
  ) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (topic) params.append('topic', topic);
      if (date) params.append('date', date);
      if (search.trim()) params.append('search', search.trim());
      params.append('limit', ITEMS_PER_PAGE.toString());
      params.append('offset', ((page - 1) * ITEMS_PER_PAGE).toString());

      const response = await fetch(`/api/filtered-snippets?${params}`);
      const data = await response.json();
      
      setSnippets(data.snippets || []);
      setTotalSnippets(data.total || 0);
      setIsDemo(!!data.isDemo);
    } catch (error) {
      console.error('Error fetching snippets:', error);
      setSnippets([]);
      setTotalSnippets(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch snippets when filters change (not search - search has its own debounced effect)
  useEffect(() => {
    fetchSnippets(topicFilter, dateFilter, '', 1);
    setSearchQuery(''); // Clear search when filters change
  }, [topicFilter, dateFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSnippets(topicFilter, dateFilter, searchQuery, 1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, topicFilter, dateFilter]);

  const handleTopicChange = (topic: string) => {
    const newTopic = topic === 'all' ? null : topic;
    setTopicFilter(newTopic);
    onFiltersChange?.({ topic: newTopic, date: dateFilter });
  };

  const handleDateChange = (date: string) => {
    const newDate = date === 'all' ? null : date;
    setDateFilter(newDate);
    onFiltersChange?.({ topic: topicFilter, date: newDate });
  };

  const clearFilters = () => {
    setTopicFilter(null);
    setDateFilter(null);
    setSearchQuery('');
    onFiltersChange?.({ topic: null, date: null });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Search and Filter Bar */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search within snippets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4"
            />
          </div>

          {/* Topic Filter */}
          <select
            value={topicFilter || 'all'}
            onChange={(e) => handleTopicChange(e.target.value)}
            className="w-48 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Topics</option>
            {topicOptions.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>

          {/* Date Filter - Simple text input for now */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Date (YYYY-MM-DD)"
              value={dateFilter || ''}
              onChange={(e) => handleDateChange(e.target.value)}
              className="pl-10 pr-4 w-48"
            />
          </div>

          {/* Clear Filters */}
          {(topicFilter || dateFilter || searchQuery) && (
            <Button 
              variant="secondary" 
              onClick={clearFilters}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>

        {/* Active Filters Display */}
        <div className="flex flex-wrap gap-2 mt-4">
          {topicFilter && (
            <Badge 
              variant="secondary" 
              style={{ borderColor: getTopicChartColor(topicFilter), color: getTopicChartColor(topicFilter) }}
              className="flex items-center gap-1"
            >
              <TrendingUp className="h-3 w-3" />
              {topicFilter}
            </Badge>
          )}
          {dateFilter && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(dateFilter)}
            </Badge>
          )}
          {searchQuery && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Search className="h-3 w-3" />
              &ldquo;{searchQuery}&rdquo;
            </Badge>
          )}
        </div>
      </div>

      {/* Results Info */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          {isLoading ? 'Loading...' : (
            <>
              {totalSnippets} snippets
              {isDemo && (
                <span className="ml-2 text-blue-600 font-medium">(Demo Data)</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Snippets Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-500">Loading snippets...</div>
          </div>
        ) : snippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <FileText className="h-12 w-12 mb-2 opacity-50" />
            <p>No snippets found</p>
            {(topicFilter || dateFilter || searchQuery) && (
              <p className="text-sm mt-1">Try adjusting your filters or search terms</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {snippets.map((snippet, index) => (
              <div 
                key={snippet.id}
                className="p-6 border-b border-slate-100 last:border-b-0"
              >
                {/* Snippet Number */}
                <div className="flex items-start justify-between mb-3">
                  <div className="text-xs text-slate-400 font-medium">
                    #{index + 1}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {snippet.source_file}
                    </div>
                    {snippet.original_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(snippet.original_date)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive Quote */}
                <div className="mb-2">
                  <InteractiveQuote
                    text={snippet.text}
                    chunkId={snippet.chunk_id}
                    relevance={0.8}
                    topic={snippet.topic}
                    source={snippet.source_file}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}