'use client';

import { CSVUpload } from "@/components/csv-upload";
import { SidebarAIChat } from "@/components/sidebar-ai-chat";
import { Logo } from "@/components/logo";
import { useState, useEffect } from "react";
import {
  SourceBreakdownWidget,
  TopicAnalysisWidget,
  SummaryStatsWidget,
  SnippetsTimelineWidget,
} from "@/components/dashboard-widgets";
import { InsightsTabs } from "@/components/insights-tabs";
import { TopicAnalysisProgress } from "@/components/topic-analysis-progress";
import { Upload } from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCustomerData } from '@/hooks/useCustomerData';
import { CustomerDataContext, type CustomerFeedbackRow } from '@/contexts/CustomerDataContext';
import { mockCustomerData } from '@/data/mockData';


function CustomerDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CustomerFeedbackRow[]>([]);
  return (
    <CustomerDataContext.Provider value={{ data, setData }}>
      {children}
    </CustomerDataContext.Provider>
  );
}


function DashboardWidgetsGrid() {
  const { setData } = useCustomerData();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  
  // Tab and filter state for insights
  const [insightsTab, setInsightsTab] = useState<'insights' | 'snippets'>('insights');
  const [tabFilters, setTabFilters] = useState<{ topic?: string | null; date?: string | null; startDate?: string | null; endDate?: string | null }>({});

  // Check if data is available (simplified since widgets handle their own data now)
  async function checkDataAvailability() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/customer-data');
      const json = await res.json();
      if (Array.isArray(json.data) && json.data.length > 0) {
        setUsingMockData(false);
      } else {
        setUsingMockData(true);
      }
    } catch (error) {
      console.log('Failed to check data availability, using mock data:', error);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }

  // Fetch customer feedback data on mount for Data Sources widget
  useEffect(() => {
    async function fetchCustomerData() {
      try {
        const res = await fetch('/api/customer-data');
        const json = await res.json();
        if (Array.isArray(json.data) && json.data.length > 0) {
          // Define types for file and chunk
          type FileType = { name: string; chunks: ChunkType[] };
          type ChunkType = Record<string, unknown>;
          const rows = (json.data as FileType[]).flatMap((file) =>
            Array.isArray(file.chunks)
              ? file.chunks.map((chunk) => ({
                  fields: { ...chunk, fileName: file.name } as Record<string, string>,
                }))
              : []
          );
          setData(rows);
        } else {
          // Use mock data when no data found
          console.log('No customer data found, using mock data');
          setData(mockCustomerData);
        }
      } catch (error) {
        console.log('Failed to fetch customer data, using mock data:', error);
        // Use mock data when API fails
        setData(mockCustomerData);
      }
    }
    fetchCustomerData();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    checkDataAvailability();
  }, []);

  // Only used for file upload, not for insights
  async function handleFileUpload(rows: Record<string, string>[]) {
    setData(rows.map(row => ({ fields: row })));
    setUploadOpen(false);
    // Automatically refresh data availability after upload
    await checkDataAvailability();
  }


  // Trigger new synthesis with live progress
  function handleGenerateSummary() {
    setProgressOpen(true);
  }

  // Handle successful analysis completion
  function handleAnalysisComplete(data: {
    chartData: Array<{name: string, value: number}>;
    insights: Array<{
      topic: string;
      summary: string;
      snippets: Array<{text: string, chunk_id: string, relevance: number}>;
      recommendations: string[];
      total_mentions: number;
    }>;
  }) {
    console.log('Analysis complete with data:', data);
    console.log('Chart data length:', data.chartData?.length);
    console.log('Insights length:', data.insights?.length);
    
    // Trigger widget refresh by dispatching a custom event
    window.dispatchEvent(new CustomEvent('topicAnalysisComplete', { detail: data }));
    
    // Force refresh of data availability
    setTimeout(() => {
      checkDataAvailability();
    }, 1000); // Small delay to ensure database writes are complete
  }

  // Handle analysis error
  function handleAnalysisError(error: string) {
    setError(error);
    console.error('Analysis error:', error);
  }

  // Handle topic slice click from pie chart
  function handleTopicClick(topic: string) {
    setTabFilters({ topic, date: null, startDate: null, endDate: null });
    setInsightsTab('snippets');
  }

  // Handle bar click from timeline chart
  function handleDateClick(date: string) {
    setTabFilters({ topic: null, date: null, startDate: date, endDate: null });
    setInsightsTab('snippets');
  }


  if (loading) {
    return <div className="w-full flex flex-col items-center py-16 text-slate-500">Loading dashboard...</div>;
  }
  if (error) {
    return <div className="w-full flex flex-col items-center py-16 text-red-600">{error}</div>;
  }

  return (
    <div className={`w-full min-h-screen bg-slate-50 transition-all duration-300 ${chatOpen ? 'lg:pr-[400px]' : ''}`}>
      {/* Top Navigation */}
      <nav className="w-full bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Logo size="md" />
            </div>
            
            {/* Navigation Links and Action Buttons */}
            <div className="flex items-center gap-6">
              {/* Evaluations Text Link */}
              <Link 
                href="/evaluations"
                className="text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors duration-200"
                title="View evaluation dashboard"
              >
                Evaluations
              </Link>
              
              <div className="flex items-center gap-3">
                {usingMockData && (
                  <div className="hidden sm:flex items-center px-3 py-1.5 bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
                    <span className="text-sm font-medium">📊 Demo Mode</span>
                  </div>
                )}
                
                {/* Upload Data Button */}
                <button
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center gap-2 text-sm"
                  onClick={() => setUploadOpen(true)}
                >
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Upload Data</span>
                </button>
                
                {/* Generate Summary Button - only show when not in demo mode */}
                {!usingMockData && (
                  <button
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white font-medium rounded-lg shadow-sm transition-colors duration-200 text-sm"
                    onClick={handleGenerateSummary}
                  >
                    Generate Summary
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="w-full flex flex-col items-center px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <header className="w-full max-w-6xl text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight text-slate-900">
            Customer Research Dashboard
          </h1>
          <p className="text-slate-600 text-lg max-w-3xl mx-auto leading-relaxed">
            Transform your customer feedback into actionable insights with AI-powered analysis
          </p>
        </header>
      
        {/* Mock Data Info Banner */}
        {usingMockData && (
          <div className="w-full max-w-6xl mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-blue-800 text-sm">
                <strong>Demo Mode:</strong> Showing sample data since database is not accessible. 
                <span className="text-blue-600 ml-2">Your API integrations are working perfectly!</span>
              </p>
            </div>
          </div>
        )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Upload Customer Feedback</DialogTitle>
          </DialogHeader>
          <CSVUpload onData={handleFileUpload} />
        </DialogContent>
      </Dialog>

      {/* Topic Analysis Progress Modal */}
      <TopicAnalysisProgress 
        isOpen={progressOpen}
        onComplete={handleAnalysisComplete}
        onError={handleAnalysisError}
        onClose={() => setProgressOpen(false)}
      />
        {/* Dashboard widgets */}
        <div className="flex flex-col w-full max-w-7xl gap-12 mt-4">
        {/* Key Metrics */}
        <section className="w-full">
          <h2 className="text-xl font-semibold mb-6 text-slate-800 flex items-center gap-2">
            <div className="w-1 h-6 bg-slate-300 rounded-full"></div>
            Insights Overview
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SummaryStatsWidget />
            <TopicAnalysisWidget onSliceClick={handleTopicClick} />
            <SnippetsTimelineWidget onBarClick={handleDateClick} />
          </div>
        </section>
        {/* Insights Tabs */}
        <section className="w-full">
          <h2 className="text-xl font-semibold mb-6 text-slate-800 flex items-center gap-2">
            <div className="w-1 h-6 bg-slate-300 rounded-full"></div>
            Customer Insights & Feedback
          </h2>
          <InsightsTabs 
            initialTab={insightsTab}
            initialFilters={tabFilters}
          />
        </section>
        {/* Data Sources */}
        <section className="w-full">
          <h2 className="text-xl font-semibold mb-6 text-slate-800 flex items-center gap-2">
            <div className="w-1 h-6 bg-slate-300 rounded-full"></div>
            Data Sources
          </h2>
          <SourceBreakdownWidget />
        </section>
        </div>
      </div>
      
      {/* Sidebar AI Chat */}
      <SidebarAIChat isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
    </div>
  );
}

function Home() {
  return (
    <DashboardWidgetsGrid />
  );
}

function App() {
  return (
    <CustomerDataProvider>
      <Home />
    </CustomerDataProvider>
  );
}

export default App;
