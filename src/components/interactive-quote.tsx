'use client';

import { useState } from 'react';
import { Eye, Search, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InteractiveQuoteProps {
  text: string;
  chunkId: string;
  relevance: number;
  topic: string;
  source?: string;
  onTriggerChat?: (message: string) => void;
}

export function InteractiveQuote({ text, source, onTriggerChat }: InteractiveQuoteProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleTellMeMore = () => {
    const query = `Tell me more about this customer feedback: "${text}" - provide deeper context, sentiment analysis, and actionable recommendations.`;
    
    if (onTriggerChat) {
      onTriggerChat(query);
    } else {
      // Fallback: dispatch custom event that the chat component can listen to
      window.dispatchEvent(new CustomEvent('triggerChatQuery', { 
        detail: { query, source: 'quote-analysis' } 
      }));
    }
  };

  const handleFindRelated = () => {
    const query = `Find other customer feedback related to: "${text}" - show me similar quotes, themes, and patterns.`;
    
    if (onTriggerChat) {
      onTriggerChat(query);
    } else {
      // Fallback: dispatch custom event that the chat component can listen to
      window.dispatchEvent(new CustomEvent('triggerChatQuery', { 
        detail: { query, source: 'related-insights' } 
      }));
    }
  };

  const handleCopyQuote = async () => {
    try {
      const quoteText = source ? `"${text}" — ${source}` : `"${text}"`;
      await navigator.clipboard.writeText(quoteText);
      setIsCopied(true);
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy quote:', err);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = source ? `"${text}" — ${source}` : `"${text}"`;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div 
      className="flex items-start gap-2 group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        // Reset copied state when mouse leaves to avoid confusion
        if (isCopied) {
          setTimeout(() => setIsCopied(false), 500);
        }
      }}
    >
      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-2 flex-shrink-0"></div>
      <div className="flex-1 relative">
        <div className="text-xs text-slate-600 italic leading-relaxed cursor-pointer hover:text-slate-800 transition-colors">
          <blockquote className="inline">
            &ldquo;{text}&rdquo;
          </blockquote>
        </div>
        
        {/* Hover Actions */}
        {isHovered && (
          <div className="absolute right-0 top-0 flex gap-1 bg-white rounded-lg shadow-lg border border-slate-200 p-1 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyQuote}
              className={`h-7 px-2 text-xs transition-colors ${
                isCopied 
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                  : 'hover:bg-slate-50 hover:text-slate-700'
              }`}
              title={isCopied ? "Quote copied!" : "Copy quote to clipboard"}
            >
              {isCopied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              <span className="ml-1 hidden sm:inline">
                {isCopied ? 'Copied!' : 'Copy'}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTellMeMore}
              className="h-7 px-2 text-xs hover:bg-blue-50 hover:text-blue-700"
              title="Get deeper insights about this quote"
            >
              <Eye className="h-3 w-3" />
              <span className="ml-1 hidden sm:inline">Tell me more</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFindRelated}
              className="h-7 px-2 text-xs hover:bg-green-50 hover:text-green-700"
              title="Find related quotes and insights"
            >
              <Search className="h-3 w-3" />
              <span className="ml-1 hidden sm:inline">Find related</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}