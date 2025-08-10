'use client';

import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

interface CSVUploadProps {
  onData?: (data: Record<string, string>[]) => void;
}

export function CSVUpload({ onData }: CSVUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      setStatus('✅ File uploaded and processed!');
      // Optionally call onData if chunk data is returned
      if (onData && json.chunks && Array.isArray(json.chunks)) {
        onData(json.chunks);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setStatus(`❌ ${err.message}`);
          } else {
        setStatus('❌ Upload failed');
          }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="font-semibold mb-2 text-slate-700">Upload File (CSV, XLSX, PDF, TXT, etc)</div>
        <Input
          ref={inputRef}
          type="file"
          onChange={handleFileChange}
          className="w-full"
        disabled={uploading}
        />
      {status && <span className="text-sm">{status}</span>}
    </div>
  );
} 