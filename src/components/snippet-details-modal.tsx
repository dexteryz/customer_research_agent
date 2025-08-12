'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Calendar, FileText, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FilteredSnippet } from '@/app/api/filtered-snippets/route';
import { getTopicChartColor } from '@/utils/topicUtils';

interface SnippetDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic?: string | null;
  date?: string | null;
  title?: string;
}

export function SnippetDetailsModal({ 
  isOpen, 
  onClose, 
  topic, 
  date, 
  title 
}: SnippetDetailsModalProps) {
  const [snippets, setSnippets] = useState<FilteredSnippet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSnippets, setTotalSnippets] = useState(0);
  
  const ITEMS_PER_PAGE = 10;
  
  // Reset search and page when modal opens with new filters
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setCurrentPage(1);
      fetchSnippets(topic, date, '', 1);
    }
  }, [isOpen, topic, date]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        setCurrentPage(1);
        fetchSnippets(topic, date, searchQuery, 1);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, topic, date, isOpen]);

  const fetchSnippets = async (
    filterTopic?: string | null, 
    filterDate?: string | null, 
    search: string = '',
    page: number = 1
  ) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTopic) params.append('topic', filterTopic);
      if (filterDate) params.append('date', filterDate);
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

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchSnippets(topic, date, searchQuery, newPage);
  };

  const totalPages = Math.ceil(totalSnippets / ITEMS_PER_PAGE);

  const getModalTitle = () => {
    if (title) return title;
    if (topic && date) return `${topic} - ${formatDate(date)}`;
    if (topic) return `${topic} Snippets`;
    if (date) return `Snippets from ${formatDate(date)}`;
    return 'Customer Feedback Snippets';
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full max-h-[80vh] flex flex-col">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {getModalTitle()}
            {isDemo && (
              <Badge variant="secondary" className="text-xs">
                Demo Data
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search within snippets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4"
          />
        </div>

        {/* Filters Summary */}
        <div className="flex flex-wrap gap-2 mb-4">
          {topic && (
            <Badge 
              variant="secondary" 
              style={{ borderColor: getTopicChartColor(topic), color: getTopicChartColor(topic) }}
              className="flex items-center gap-1"
            >
              <TrendingUp className="h-3 w-3" />
              {topic}
            </Badge>
          )}
          {date && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(date)}
            </Badge>
          )}
          {searchQuery && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Search className="h-3 w-3" />
              &ldquo;{searchQuery}&rdquo;
            </Badge>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="text-slate-500">Loading snippets...</div>
          </div>
        )}

        {/* Snippets List */}
        {!isLoading && (
          <div className="flex-1 overflow-y-auto">
            {snippets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <FileText className="h-12 w-12 mb-2 opacity-50" />
                <p>No snippets found</p>
                {(topic || date || searchQuery) && (
                  <p className="text-sm mt-1">Try adjusting your filters or search terms</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {snippets.map((snippet, index) => (
                  <div 
                    key={snippet.id}
                    className="p-4 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
                  >
                    {/* Snippet Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge 
                          variant="secondary"
                          style={{ 
                            backgroundColor: getTopicChartColor(snippet.topic) + '20',
                            color: getTopicChartColor(snippet.topic),
                            borderColor: getTopicChartColor(snippet.topic) + '40'
                          }}
                          className="text-xs font-medium"
                        >
                          {snippet.topic}
                        </Badge>
                        {snippet.relevance_score > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(snippet.relevance_score * 100)}% relevant
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 text-right">
                        #{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                      </div>
                    </div>

                    {/* Snippet Content */}
                    <div className="mb-3">
                      <p className="text-slate-700 leading-relaxed">
                        {highlightSearchTerm(snippet.text, searchQuery)}
                      </p>
                    </div>

                    {/* Snippet Metadata */}
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
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-4">
            <div className="text-sm text-slate-500">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalSnippets)} of {totalSnippets} snippets
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="flex items-center gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Import MessageSquare from lucide-react if not already imported
import { MessageSquare } from 'lucide-react';