import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { google } from 'googleapis';
import Papa from 'papaparse';

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !token.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { fileId, mimeType } = await req.json();
  if (!fileId || !mimeType) {
    return NextResponse.json({ error: 'Missing fileId or mimeType' }, { status: 400 });
  }
  const drive = (() => {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: String(token.accessToken) });
    return google.drive({ version: 'v3', auth: oauth2Client });
  })();
  try {
    let rows: Record<string, string>[] = [];
    console.log('Exporting file:', { fileId, mimeType });
    // Fetch and log file metadata for debugging
    const metaRes = await drive.files.get({ fileId, fields: '*' });
    console.log('Drive file metadata:', metaRes.data);
    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      // Export as CSV
      const res = await drive.files.export({ fileId, mimeType: 'text/csv' }, { responseType: 'stream' });
      const csv = await streamToString(res.data);
      rows = parseCSV(csv);
    } else if (mimeType === 'application/vnd.google-apps.document') {
      // Export as plain text
      const res = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'stream' });
      const text = await streamToString(res.data);
      rows = parseTextDoc(text);
    } else if (mimeType === 'text/csv' || mimeType === 'application/vnd.ms-excel') {
      // Download file content (supportsAllDrives for shared drives)
      const res = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
      const csv = await streamToString(res.data);
      rows = parseCSV(csv);
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }
    return NextResponse.json({ rows });
  } catch (err) {
    // Type guard for error object
    interface ErrorWithResponse {
      response?: {
        status?: unknown;
        data?: unknown;
        headers?: unknown;
      };
    }
    if (typeof err === 'object' && err !== null && 'response' in err) {
      const e = err as ErrorWithResponse;
      if (e.response) {
        console.error('Drive download error details:', {
          status: e.response.status,
          data: e.response.data,
          headers: e.response.headers,
        });
      }
    }
    console.error('Drive download error:', err);
    return NextResponse.json({ error: 'Failed to download or parse file', details: String(err) }, { status: 500 });
  }
}

function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    stream.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

function parseCSV(csv: string): Record<string, string>[] {
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  return Array.isArray(parsed.data) ? parsed.data as Record<string, string>[] : [];
}

function parseTextDoc(text: string): Record<string, string>[] {
  // Simple: treat each line as a row, split by tab or comma
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/\t|,/);
  return lines.slice(1).map(line => {
    const values = line.split(/\t|,/);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = values[i]?.trim() || ''; });
    return row;
  });
} 