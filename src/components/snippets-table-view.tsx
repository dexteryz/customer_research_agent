'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Calendar, FileText, TrendingUp, X } from 'lucide-react';
import type { FilteredSnippet } from '@/app/api/filtered-snippets/route';
import { getTopicChartColor } from '@/utils/topicUtils';

interface SnippetsTableViewProps {
  initialFilters?: {
    topic?: string | null;
    date?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  onFiltersChange?: (filters: { topic?: string | null; date?: string | null; startDate?: string | null; endDate?: string | null }) => void;
}

export function SnippetsTableView({ initialFilters, onFiltersChange }: SnippetsTableViewProps) {
  const [snippets, setSnippets] = useState<FilteredSnippet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [totalSnippets, setTotalSnippets] = useState(0);
  const [topicFilter, setTopicFilter] = useState<string | null>(initialFilters?.topic || null);
  const [dateFilter, setDateFilter] = useState<string | null>(initialFilters?.date || null);
  const [startDate, setStartDate] = useState<string | null>(initialFilters?.startDate || null);
  const [endDate, setEndDate] = useState<string | null>(initialFilters?.endDate || null);
  const [noDateFilter, setNoDateFilter] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  const ITEMS_PER_PAGE = 50; // Paginate with 50 per page
  
  // Available topic options
  const topicOptions = ['Pain Points', 'Blockers', 'Customer Requests', 'Solution Feedback'];

  // Update filters when initialFilters change
  useEffect(() => {
    if (initialFilters?.topic !== topicFilter || 
        initialFilters?.date !== dateFilter ||
        initialFilters?.startDate !== startDate ||
        initialFilters?.endDate !== endDate) {
      setTopicFilter(initialFilters?.topic || null);
      setDateFilter(initialFilters?.date || null);
      setStartDate(initialFilters?.startDate || null);
      setEndDate(initialFilters?.endDate || null);
      setSearchQuery('');
    }
  }, [initialFilters?.topic, initialFilters?.date, initialFilters?.startDate, initialFilters?.endDate, topicFilter, dateFilter, startDate, endDate]);

  const fetchSnippets = async (
    topic?: string | null, 
    date?: string | null, 
    search: string = '',
    page: number = 1,
    startDate?: string | null,
    endDate?: string | null,
    noDate?: boolean
  ) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (topic) params.append('topic', topic);
      if (date) params.append('date', date);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (noDate) params.append('noDate', 'true');
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
    setCurrentPage(1); // Reset to first page when filters change
    fetchSnippets(topicFilter, dateFilter, '', 1, startDate, endDate, noDateFilter);
    setSearchQuery(''); // Clear search when filters change
  }, [topicFilter, dateFilter, startDate, endDate, noDateFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== '' || currentPage === 1) {
        setCurrentPage(1); // Reset to first page when search changes
        fetchSnippets(topicFilter, dateFilter, searchQuery, 1, startDate, endDate, noDateFilter);
      } else {
        fetchSnippets(topicFilter, dateFilter, searchQuery, currentPage, startDate, endDate, noDateFilter);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentPage, topicFilter, dateFilter, startDate, endDate, noDateFilter]);

  const handleTopicChange = (topic: string) => {
    const newTopic = topic === 'all' ? null : topic;
    setTopicFilter(newTopic);
    onFiltersChange?.({ topic: newTopic, date: dateFilter });
  };


  const clearFilters = () => {
    setTopicFilter(null);
    setDateFilter(null);
    setStartDate(null);
    setEndDate(null);
    setNoDateFilter(false);
    setSearchQuery('');
    onFiltersChange?.({ topic: null, date: null, startDate: null, endDate: null });
  };

  const handleStartDateChange = (date: string) => {
    setStartDate(date || null);
    onFiltersChange?.({ topic: topicFilter, date: null, startDate: date || null, endDate });
  };

  const handleEndDateChange = (date: string) => {
    setEndDate(date || null);
    onFiltersChange?.({ topic: topicFilter, date: null, startDate, endDate: date || null });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const highlightSearchTerms = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <strong key={index} className="bg-yellow-200 font-bold">
          {part}
        </strong>
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

          {/* Date Range Filters */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <div className="flex items-center gap-2">
              <div className="relative">
                <Input
                  type="date"
                  placeholder="Start Date"
                  value={startDate || ''}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="w-36 text-xs"
                />
                <div className="absolute -bottom-5 left-0 text-xs text-slate-400">From</div>
              </div>
              
              <div className="text-xs text-slate-500">to</div>
              
              <div className="relative">
                <Input
                  type="date"
                  placeholder="End Date"
                  value={endDate || ''}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="w-36 text-xs"
                />
                <div className="absolute -bottom-5 left-0 text-xs text-slate-400">To</div>
              </div>
            </div>
          </div>

          {/* No Date Filter */}
          <Button 
            variant={noDateFilter ? "default" : "outline"} 
            size="sm"
            onClick={() => {
              setNoDateFilter(!noDateFilter);
              // Clear date filters when using No Date filter
              if (!noDateFilter) {
                setStartDate(null);
                setEndDate(null);
              }
            }}
            className="text-xs"
          >
            No Date
          </Button>

          {/* Clear Filters */}
          {(topicFilter || startDate || endDate || searchQuery || noDateFilter) && (
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
              className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleTopicChange('')}
            >
              <TrendingUp className="h-3 w-3" />
              {topicFilter}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {(startDate || endDate) && (
            <Badge 
              variant="secondary" 
              className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
                onFiltersChange?.({ topic: topicFilter, date: null, startDate: null, endDate: null });
              }}
            >
              <Calendar className="h-3 w-3" />
              {startDate && endDate 
                ? `${formatDate(startDate)} - ${formatDate(endDate)}`
                : startDate 
                ? formatDate(startDate)
                : endDate 
                ? `Until ${formatDate(endDate)}`
                : 'Date Range'
              }
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {noDateFilter && (
            <Badge 
              variant="secondary" 
              className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setNoDateFilter(false)}
            >
              <Calendar className="h-3 w-3" />
              No Date
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {searchQuery && (
            <Badge 
              variant="secondary" 
              className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setSearchQuery('')}
            >
              <Search className="h-3 w-3" />
              &ldquo;{searchQuery}&rdquo;
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
        </div>
      </div>

      {/* Results Info and Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          {isLoading ? 'Loading...' : (
            <>
              {(() => {
                if (totalSnippets > ITEMS_PER_PAGE) {
                  const startResult = (currentPage - 1) * ITEMS_PER_PAGE + 1;
                  const endResult = Math.min(currentPage * ITEMS_PER_PAGE, totalSnippets);
                  return `Showing ${startResult}-${endResult} of ${totalSnippets} snippets`;
                } else {
                  return `${totalSnippets} snippets`;
                }
              })()}
              {isDemo && (
                <span className="ml-2 text-blue-600 font-medium">(Demo Data)</span>
              )}
            </>
          )}
        </div>
        
        {/* Pagination Controls */}
        {!isLoading && totalSnippets > ITEMS_PER_PAGE && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 px-3 text-sm"
            >
              Previous
            </Button>
            <div className="px-3 text-sm text-slate-500">
              {currentPage} of {Math.ceil(totalSnippets / ITEMS_PER_PAGE)}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= Math.ceil(totalSnippets / ITEMS_PER_PAGE)}
              className="h-8 px-3 text-sm"
            >
              Next
            </Button>
          </div>
        )}
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
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            {/* Table Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
              <div className="grid grid-cols-12 gap-4 text-xs font-medium text-slate-600 uppercase tracking-wide">
                <div className="col-span-2">Date</div>
                <div className="col-span-6">Snippet</div>
                <div className="col-span-2">Topic</div>
                <div className="col-span-2">Source</div>
              </div>
            </div>
            
            {/* Table Body */}
            <div className="divide-y divide-slate-200">
              {snippets.map((snippet) => (
                <div 
                  key={snippet.id}
                  className="px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="grid grid-cols-12 gap-4 items-start">
                    {/* Date Column */}
                    <div className="col-span-2">
                      <div className="text-sm text-slate-600">
                        {snippet.original_date ? formatDate(snippet.original_date) : 'No date'}
                      </div>
                    </div>
                    
                    {/* Snippet Column */}
                    <div className="col-span-6">
                      <div className="text-sm text-slate-800 leading-relaxed">
                        {highlightSearchTerms(snippet.text, searchQuery)}
                      </div>
                    </div>
                    
                    {/* Topic Column */}
                    <div className="col-span-2">
                      <Badge 
                        variant="secondary" 
                        style={{ 
                          backgroundColor: `${getTopicChartColor(snippet.topic)}15`,
                          borderColor: getTopicChartColor(snippet.topic),
                          color: getTopicChartColor(snippet.topic)
                        }}
                        className="text-xs font-medium"
                      >
                        {snippet.topic}
                      </Badge>
                    </div>
                    
                    {/* Source Column */}
                    <div className="col-span-2">
                      <div className="text-xs text-slate-500 truncate" title={snippet.source_file}>
                        {snippet.source_file}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}