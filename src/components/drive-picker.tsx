// Google Drive Picker using Google Picker API
// Requirements:
// 1. GOOGLE_API_KEY: Your Google API key (enable Picker API in Google Cloud Console)
// 2. GOOGLE_CLIENT_ID: Your OAuth client ID (already used for NextAuth)
// 3. NextAuth must provide a valid Google access token in the session
//
// Usage: <DrivePicker onData={handleData} />

'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSession, signIn } from 'next-auth/react';

// Add global types for Google Picker API
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gapi?: any;
  }
}

interface DrivePickerProps {
  onData: (file: unknown) => void;
}

interface GoogleSession {
  accessToken?: string;
  // Add other session fields as needed
}

// Loads the Google Picker API script
function useGooglePickerScript() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (window.google && window.google.picker) {
      setLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);
  return loaded;
}

export function DrivePicker({ onData }: DrivePickerProps) {
  const { data: session, status } = useSession();
  const pickerApiLoaded = useGooglePickerScript();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<unknown>(null);

  // Launch Google Picker
  async function openPicker() {
    setError(null);
    if (status !== 'authenticated') {
      await signIn('google');
      return;
    }
    const googleSession = session as GoogleSession | null;
    const accessToken = googleSession?.accessToken;
    if (!accessToken) {
      setError('No Google access token found. Please re-login.');
      return;
    }
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    if (!apiKey || !clientId) {
      setError(
        `Google API key or Client ID not set.\n` +
        `apiKey: ${apiKey}\nclientId: ${clientId}`
      );
      return;
    }
    setIsLoading(true);
    // Log for debugging
    // eslint-disable-next-line no-console
    console.log('Picker config:', { apiKey, clientId, accessToken });
    // Load picker
    function createPicker() {
      if (!window.google || !window.google.picker) {
        setError('Google Picker API not loaded.');
        setIsLoading(false);
        return;
      }
      const view = new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes('application/vnd.google-apps.folder,application/vnd.google-apps.spreadsheet,application/vnd.google-apps.document,application/vnd.ms-excel,text/csv');
      const picker = new window.google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        // .setAppId(projectNumber) // REMOVED to avoid 400 errors
        .setCallback((data: unknown) => {
          const d = data as { action: string; docs?: unknown[] };
          if (d.action === window.google.picker.Action.PICKED && d.docs && d.docs.length > 0) {
            onData(d.docs[0]);
          }
          if (d.action === window.google.picker.Action.CANCEL) {
            setIsLoading(false);
          }
        })
        .setTitle('Select a Google Drive File or Folder')
        .build();
      pickerRef.current = picker;
      picker.setVisible(true);
      setIsLoading(false);
    }
    // Load picker API if needed
    if (window.google && window.google.picker) {
      createPicker();
    } else if (window.gapi) {
      window.gapi.load('picker', createPicker);
    } else {
      setError('Google API not loaded.');
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={openPicker}
        disabled={isLoading || !pickerApiLoaded}
      >
        <span role="img" aria-label="Google Drive" className="mr-2">📁</span>
        {isLoading ? 'Loading Picker…' : 'Browse Google Drive'}
      </Button>
      {error && <div className="text-destructive text-sm">{error}</div>}
    </div>
  );
} 