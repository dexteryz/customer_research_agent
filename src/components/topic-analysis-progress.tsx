'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface AnalysisData {
  chartData: Array<{name: string, value: number}>;
  insights: Array<{
    topic: string;
    summary: string;
    snippets: Array<{text: string, chunk_id: string, relevance: number}>;
    recommendations: string[];
    total_mentions: number;
  }>;
}

interface ProgressUpdate {
  type: 'progress' | 'complete' | 'error' | 'keepalive';
  message: string;
  progress?: number;
  data?: AnalysisData;
}

interface TopicAnalysisProgressProps {
  isOpen: boolean;
  onComplete: (data: AnalysisData) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

export function TopicAnalysisProgress({ isOpen, onComplete, onError, onClose }: TopicAnalysisProgressProps) {
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('');
  const [status, setStatus] = useState<'running' | 'complete' | 'error'>('running');
  const [batchInfo, setBatchInfo] = useState<{current: number, total: number, pending: number} | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setProgress(0);
      setCurrentMessage('');
      setStatus('running');
      setBatchInfo(null);
      return;
    }

    let eventSource: EventSource;
    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeout: NodeJS.Timeout;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/llm/topic-analysis-progress');
        
        // Set a connection timeout
        const connectionTimeout = setTimeout(() => {
          if (eventSource.readyState === EventSource.CONNECTING) {
            console.log('SSE connection timeout');
            eventSource.close();
            if (retryCount < maxRetries) {
              retryCount++;
              setCurrentMessage(`Connection timeout, retrying... (${retryCount}/${maxRetries})`);
              retryTimeout = setTimeout(() => connectSSE(), 2000);
            } else {
              setStatus('error');
              setCurrentMessage('Connection timeout after multiple attempts');
              onError('Connection timeout. Please try again.');
            }
          }
        }, 15000); // 15 second connection timeout
        
        eventSource.onopen = () => {
          console.log('SSE connection established');
          clearTimeout(connectionTimeout);
          retryCount = 0; // Reset retry count on successful connection
          setCurrentMessage('Connected to analysis service...');
        };
        
        eventSource.onmessage = (event) => {
          try {
            const update: ProgressUpdate = JSON.parse(event.data);
            
            // Handle different message types
            if (update.type === 'keepalive') {
              // Don't update UI for keepalive messages, just acknowledge connection is active
              console.log('Keepalive received');
              return;
            }
            
            setCurrentMessage(update.message);
            
            // Extract batch information from message
            const batchMatch = update.message.match(/batch (\d+)\/(\d+).*?(\d+) batches pending/);
            if (batchMatch) {
              setBatchInfo({
                current: parseInt(batchMatch[1]),
                total: parseInt(batchMatch[2]),
                pending: parseInt(batchMatch[3])
              });
            }
            
            if (update.progress !== undefined) {
              setProgress(update.progress);
            }

            if (update.type === 'complete') {
              setStatus('complete');
              setTimeout(() => {
                if (update.data) {
                  onComplete(update.data);
                }
                onClose();
              }, 1500); // Show completion for 1.5s then close
            } else if (update.type === 'error') {
              setStatus('error');
              onError(update.message);
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error);
            setCurrentMessage('Error parsing server message');
          }
        };

        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          clearTimeout(connectionTimeout);
          
          // Don't treat normal connection closure during completion as an error
          if (status === 'complete') {
            return;
          }
          
          // Check connection state and only retry if truly disconnected
          if (eventSource.readyState === EventSource.CLOSED || eventSource.readyState === EventSource.CONNECTING) {
            try {
              eventSource.close();
            } catch (closeError) {
              console.log('Error closing EventSource:', closeError);
            }
            
            if (retryCount < maxRetries && status !== 'error') {
              retryCount++;
              setCurrentMessage(`Connection interrupted, reconnecting... (${retryCount}/${maxRetries})`);
              
              retryTimeout = setTimeout(() => {
                connectSSE();
              }, Math.min(1000 * retryCount, 5000)); // Exponential backoff with max 5s
            } else {
              setStatus('error');
              setCurrentMessage('Connection failed after multiple attempts');
              onError('Connection failed. Please try again.');
            }
          }
        };

      } catch (error) {
        console.error('Error creating SSE connection:', error);
        setStatus('error');
        setCurrentMessage('Failed to establish connection');
        onError('Failed to establish connection to analysis service');
      }
    };

    connectSSE();

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [isOpen, onComplete, onError, onClose, status]);

  return (
    <Dialog open={isOpen} onOpenChange={status === 'running' ? undefined : onClose}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === 'running' && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
            {status === 'complete' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
            Topic Analysis Progress
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>

          {/* Current Status */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Status:</div>
            <div className={`text-sm p-3 rounded-lg border ${
              status === 'error' 
                ? 'bg-red-50 border-red-200 text-red-800'
                : status === 'complete'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              {currentMessage || 'Initializing...'}
            </div>
            {batchInfo && (
              <div className="text-xs text-slate-500 text-center mt-2">
                Batch {batchInfo.current} of {batchInfo.total} • {batchInfo.pending} remaining
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end pt-2">
            {status === 'error' && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            )}
            {status === 'complete' && (
              <div className="text-sm text-green-600 font-medium">
                ✓ Analysis complete! Updating widgets...
              </div>
            )}
            {status === 'running' && (
              <div className="text-sm text-blue-600 font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}