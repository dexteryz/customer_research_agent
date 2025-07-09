'use client';

import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import Papa, { ParseResult } from 'papaparse';
import * as XLSX from 'xlsx';

interface CSVUploadProps {
  onData: (data: Record<string, string>[]) => void;
}

function generateHeaders(length: number): string[] {
  return Array.from({ length }, (_, i) => `column_${i + 1}`);
}

function normalizeRows(rows: string[][], headers: string[]): Record<string, string>[] {
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] ?? '';
    });
    return obj;
  });
}

export function CSVUpload({ onData }: CSVUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setSuccess(false);
    setWarning(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      Papa.parse<string[]>(file, {
        skipEmptyLines: true,
        complete: (results: ParseResult<string[]>) => {
          if (results.errors.length) {
            setError('Failed to parse CSV.');
            return;
          }
          const data = results.data;
          if (!Array.isArray(data) || data.length === 0) {
            setError('No data found in CSV.');
            return;
          }
          // Check if first row looks like headers (all unique, not all empty)
          const firstRow = data[0];
          const unique = new Set(firstRow.filter(Boolean));
          let headers: string[];
          let startIdx = 1;
          if (
            unique.size === firstRow.length &&
            firstRow.some((cell) => cell.trim() !== '') &&
            firstRow.every((cell) => typeof cell === 'string')
          ) {
            headers = firstRow.map((h, i) => h.trim() || `column_${i + 1}`);
          } else {
            headers = generateHeaders(firstRow.length);
            startIdx = 0;
            setWarning('No headers detected. Using generic column names.');
          }
          // Deduplicate headers
          const seen = new Set<string>();
          headers = headers.map((h) => {
            let name = h;
            let count = 1;
            while (seen.has(name)) {
              name = `${h}_${count++}`;
            }
            seen.add(name);
            return name;
          });
          const rows = data.slice(startIdx);
          const normalized = normalizeRows(rows, headers);
          if (normalized.length === 0) {
            setError('No rows found in CSV.');
            return;
          }
          if (headers.length > 20) {
            setWarning('CSV has many columns. Preview may be truncated.');
          }
          setSuccess(true);
          onData(normalized);
        },
        error: () => setError('Failed to parse CSV.'),
      });
    } else if (['xlsx', 'xls', 'gsheet'].includes(ext || '')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
          const filteredRows = (json as string[][]).filter(row => Array.isArray(row) && row.some(cell => (cell ?? '').toString().trim() !== ''));
          if (!Array.isArray(filteredRows) || filteredRows.length === 0) {
            setError('No data found in sheet.');
            return;
          }
          const firstRow = filteredRows[0] as string[];
          const unique = new Set(firstRow.filter(Boolean));
          let headers: string[];
          let startIdx = 1;
          if (
            unique.size === firstRow.length &&
            firstRow.some((cell) => cell.trim() !== '') &&
            firstRow.every((cell) => typeof cell === 'string')
          ) {
            headers = firstRow.map((h, i) => h.trim() || `column_${i + 1}`);
          } else {
            headers = generateHeaders(firstRow.length);
            startIdx = 0;
            setWarning('No headers detected. Using generic column names.');
          }
          // Deduplicate headers
          const seen = new Set<string>();
          headers = headers.map((h) => {
            let name = h;
            let count = 1;
            while (seen.has(name)) {
              name = `${h}_${count++}`;
            }
            seen.add(name);
            return name;
          });
          const rows = filteredRows.slice(startIdx);
          const normalized = normalizeRows(rows, headers);
          if (normalized.length === 0) {
            setError('No rows found in sheet.');
            return;
          }
          if (headers.length > 20) {
            setWarning('Sheet has many columns. Preview may be truncated.');
          }
          setSuccess(true);
          onData(normalized);
        } catch {
          setError('Failed to parse spreadsheet.');
        }
      };
      reader.onerror = () => setError('Failed to read file.');
      reader.readAsArrayBuffer(file);
    } else {
      setError('Unsupported file type. Please upload a .csv, .gsheet, .xlsx, or .xls file.');
    }
  }

  return (
    <div className="flex flex-col gap-2 items-start w-full">
      <Input
        ref={inputRef}
        type="file"
        accept=".csv,.gsheet,.xlsx,.xls"
        onChange={handleFileChange}
        className="w-full"
      />
      {error && <span className="text-destructive text-sm">{error}</span>}
      {warning && <span className="text-warning text-sm">{warning}</span>}
      {success && <span className="text-success text-sm">File uploaded successfully!</span>}
    </div>
  );
} 