'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Send, Bot, User, Loader2, MessageCircle, X } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
  queryAnalysis?: {
    intent: string;
    focus: string[];
    searchMethod: string;
    searchTermsUsed: string[];
    originalQuery: string;
  };
}

interface ChatResponse {
  answer: string;
  results?: Array<{ content?: string; chunk_content?: string }>;
  error?: string;
  queryAnalysis?: {
    intent: string;
    focus: string[];
    searchMethod: string;
    searchTermsUsed: string[];
    originalQuery: string;
  };
}

interface SidebarAIChatProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function SidebarAIChat({ isOpen, onToggle }: SidebarAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I can help you explore your customer research data. Ask me anything about your uploaded customer feedback, pain points, or insights.',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const submitQuery = useCallback(async (queryText: string) => {
    setLoading(true);
    setError(null);

    try {
      // Include recent conversation history for context
      const recentMessages = messages.slice(-4); // Last 4 messages for context
      const conversationHistory = recentMessages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const response = await fetch('/api/rag-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: queryText, 
          topK: 8,
          conversationHistory: conversationHistory
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChatResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer || 'I apologize, but I couldn\'t find relevant information to answer your question.',
        timestamp: new Date(),
        sources: data.results?.map(r => r.content || r.chunk_content || '').filter(Boolean),
        queryAnalysis: data.queryAnalysis,
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [messages]);

  // Listen for chat trigger events from interactive quotes
  useEffect(() => {
    const handleChatTrigger = (event: CustomEvent) => {
      const { query } = event.detail;
      
      // Open the chat if it's not already open
      if (!isOpen) {
        onToggle();
      }
      
      // Set the query in the input and automatically submit it
      setInput(query);
      
      // Small delay to ensure the chat is opened before submitting
      setTimeout(() => {
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: query,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);
        setError(null);

        // Submit the query
        submitQuery(query);
      }, 100);
    };

    window.addEventListener('triggerChatQuery', handleChatTrigger as EventListener);

    return () => {
      window.removeEventListener('triggerChatQuery', handleChatTrigger as EventListener);
    };
  }, [isOpen, submitQuery, onToggle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const queryText = input.trim();
    setInput('');
    
    await submitQuery(queryText);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Floating Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-6 right-6 bg-slate-900 hover:bg-slate-800 text-white rounded-full p-4 shadow-lg transition-all duration-200 z-50 hover:scale-105"
          title="Open AI Chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Sidebar Chat Panel */}
      <div
        className={`fixed top-0 right-0 h-full bg-white border-l border-slate-200 shadow-xl z-40 transition-transform duration-300 ease-in-out w-full lg:w-[400px] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">AI Research Assistant</h3>
              <p className="text-xs text-slate-500">Ask about your customer data</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
            title="Close chat"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(100vh - 140px)' }}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-3 h-3" />
                ) : (
                  <Bot className="w-3 h-3" />
                )}
              </div>

              <div className={`flex-1 max-w-[280px] ${
                message.role === 'user' ? 'text-right' : 'text-left'
              }`}>
                <div className={`inline-block p-3 rounded-lg text-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}>
                  <div className="whitespace-pre-line">{message.content}</div>
                </div>
                
                <div className="mt-1 text-xs text-slate-500">
                  {formatTime(message.timestamp)}
                </div>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-slate-500 mb-1">Sources:</div>
                    <div className="space-y-1">
                      {message.sources.slice(0, 3).map((source, index) => (
                        <div key={index} className="text-xs bg-slate-50 p-2 rounded border-l-2 border-blue-200">
                          {source.slice(0, 100)}...
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Query Analysis */}
                {message.queryAnalysis && (
                  <div className="mt-2 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Intent:</span>
                      <span>{message.queryAnalysis.intent}</span>
                    </div>
                    {message.queryAnalysis.searchMethod && (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Method:</span>
                        <span>{message.queryAnalysis.searchMethod}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                <Bot className="w-3 h-3" />
              </div>
              <div className="flex-1">
                <div className="inline-block p-3 rounded-lg bg-slate-100 text-slate-800">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your customer research..."
              disabled={loading}
              className="flex-1 text-sm"
            />
            <Button type="submit" disabled={loading || !input.trim()} size="sm">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}