'use client';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { CSVUpload } from "@/components/csv-upload";
import { useState, createContext, useContext } from "react";
import {
  OverallSentimentWidget,
  TopPainPointsWidget,
  KeyQuotesWidget,
  HighlightsWidget,
  SuggestedImprovementsWidget,
  SourceBreakdownWidget,
  CustomerProfileBreakdownWidget,
} from "@/components/dashboard-widgets";
import { DrivePicker } from '@/components/drive-picker';
import { Plus, Upload } from 'lucide-react';
import { RAGSearch } from '@/components/rag-search';

interface CustomerFeedbackRow {
  fields: Record<string, string>;
  tags?: string[];
  category?: string;
}

interface CustomerDataContextType {
  data: CustomerFeedbackRow[];
  setData: (data: CustomerFeedbackRow[]) => void;
}

const CustomerDataContext = createContext<CustomerDataContextType | undefined>(undefined);

function CustomerDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CustomerFeedbackRow[]>([]);
  return (
    <CustomerDataContext.Provider value={{ data, setData }}>
      {children}
    </CustomerDataContext.Provider>
  );
}

export function useCustomerData() {
  const ctx = useContext(CustomerDataContext);
  if (!ctx) throw new Error("useCustomerData must be used within CustomerDataProvider");
  return ctx;
}

function DashboardWidgetsGrid() {
  const { data } = useCustomerData();
  const [open, setOpen] = useState(false);
  
  return (
    <div className="w-full flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-6xl mb-12 text-center">
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-4 tracking-tight text-slate-900">
            Customer Research Insights
          </h1>
          <p className="text-slate-600 text-lg max-w-3xl mx-auto leading-relaxed">
            Transform your customer feedback into actionable insights. Upload data from multiple sources and get AI-powered analysis to drive better decisions.
          </p>
        </div>
        {data.length > 0 && (
          <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span>{data.length} responses analyzed</span>
            </div>
            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
            <span>Last updated: {new Date().toLocaleDateString()}</span>
          </div>
        )}
      </header>
      {data.length === 0 ? (
        <div className="w-full max-w-2xl text-center">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-12 border border-slate-200">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <Upload className="h-8 w-8 text-slate-500" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              Start Your Research Analysis
            </h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              Upload customer feedback data to begin generating insights. Support for CSV files, Google Sheets, and more data sources coming soon.
            </p>
            <Button 
              onClick={() => setOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3"
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload Data
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col w-full max-w-7xl gap-12">
            {/* Key Metrics */}
            <section className="w-full">
              <h2 className="text-xl font-semibold mb-6 text-slate-800 flex items-center gap-2">
                <div className="w-1 h-6 bg-slate-300 rounded-full"></div>
                Key Metrics
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <OverallSentimentWidget />
                <CustomerProfileBreakdownWidget />
              </div>
            </section>
            {/* Research Insights */}
            <section className="w-full">
              <h2 className="text-xl font-semibold mb-6 text-slate-800 flex items-center gap-2">
                <div className="w-1 h-6 bg-slate-300 rounded-full"></div>
                Research Insights
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <HighlightsWidget />
                <TopPainPointsWidget />
              </div>
            </section>
            {/* Customer Voice */}
            <section className="w-full">
              <h2 className="text-xl font-semibold mb-6 text-slate-800 flex items-center gap-2">
                <div className="w-1 h-6 bg-slate-300 rounded-full"></div>
                Customer Voice
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <KeyQuotesWidget />
                <SuggestedImprovementsWidget />
              </div>
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
          {/* RAG Search Section */}
          <div className="w-full max-w-7xl mt-12">
            <h2 className="text-xl font-semibold mb-4 text-slate-800 flex items-center gap-2">
              <div className="w-1 h-6 bg-slate-300 rounded-full"></div>
              Ask Your Data (RAG Search)
            </h2>
            <RAGSearch />
          </div>
        </>
      )}
      {/* Floating Upload Button */}
      <FloatingUploadButton open={open} setOpen={setOpen} />
    </div>
  );
}

function FloatingUploadButton({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { setData } = useCustomerData();

  async function enrichRows(rows: Record<string, string>[]): Promise<CustomerFeedbackRow[]> {
    // For each row, call /api/llm/tag and /api/llm/categorize
    const texts = rows.map(row => Object.values(row).join(' '));
    // Batch tag
    const tagRes = await fetch('/api/llm/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
    });
    const tagJson = await tagRes.json();
    // Batch categorize
    const catRes = await fetch('/api/llm/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
    });
    const catJson = await catRes.json();
    // Map tags/categories to rows
    return rows.map((row, i) => ({
      fields: row,
      tags: tagJson.results?.[i]?.tags || [],
      category: catJson.results?.[i]?.category || '',
    }));
  }

  return (
    <>
      <Button
        variant="default"
        className="fixed bottom-6 right-6 z-50 shadow-lg rounded-full px-6 py-3 text-base"
        onClick={() => setOpen(true)}
      >
        Upload Data
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect a Data Source</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <Button variant="outline" className="w-full justify-start">
              <span role="img" aria-label="Gmail" className="mr-2">📧</span>
              Connect Gmail
            </Button>
            <DrivePicker
              onData={async (file) => {
                if (!file || typeof file !== 'object' || !('id' in file) || !('mimeType' in file)) return;
                const res = await fetch('/api/drive/download', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fileId: file.id, mimeType: file.mimeType }),
                });
                const json = await res.json();
                if (json.rows) {
                  const enriched = await enrichRows(json.rows);
                  setData(enriched);
                }
                // Optionally handle errors here
              }}
            />
            <Button variant="outline" className="w-full justify-start">
              <span role="img" aria-label="LinkedIn" className="mr-2">💼</span>
              Connect LinkedIn
            </Button>
            <Separator />
            <CSVUpload onData={async (rows) => {
              const enriched = await enrichRows(rows);
              setData(enriched);
            }} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Home() {
  return (
    <main className="flex flex-col items-center min-h-screen bg-background p-8">
      <DashboardWidgetsGrid />
    </main>
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
