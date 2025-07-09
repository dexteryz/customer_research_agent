import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { google } from 'googleapis';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  owners?: { displayName?: string }[];
  shared?: boolean;
  parents?: string[];
  driveId?: string;
}

export async function GET(req: NextRequest) {
  // Log incoming headers for debugging
  console.log('Drive API request headers:', Object.fromEntries(req.headers.entries()));
  // Log NEXTAUTH_SECRET (masked)
  const secret = process.env.NEXTAUTH_SECRET;
  console.log('NEXTAUTH_SECRET:', secret ? secret.slice(0, 4) + '...' : 'undefined');
  // Get and log token
  const token = await getToken({ req, secret });
  console.log('Drive API token:', token);
  if (!token || !token.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  // Create OAuth2 client and set credentials
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    undefined // No redirect URI needed for server-side usage
  );
  oauth2Client.setCredentials({ access_token: String(token.accessToken) });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  try {
    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');
    let files: DriveFile[] = [];
    if (!folderId) {
      // List all drives (My Drive + shared drives)
      const drivesRes = await drive.drives.list({ pageSize: 100 });
      const drives = drivesRes.data.drives || [];
      // My Drive root
      const myDriveRes = await drive.files.list({
        pageSize: 100,
        fields: 'files(id, name, mimeType, modifiedTime, owners, shared, parents, driveId)',
        q: "'root' in parents and (mimeType='application/vnd.google-apps.folder' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.ms-excel' or mimeType='text/csv') and trashed=false",
        corpora: 'user',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });
      files = (myDriveRes.data.files || []).filter(f => f.id && f.name).map(f => ({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        modifiedTime: f.modifiedTime ?? undefined,
        owners: f.owners?.map(o => ({ displayName: o.displayName ?? undefined })) ?? undefined,
        shared: f.shared === true ? true : undefined,
        parents: f.parents ?? undefined,
        driveId: f.driveId ?? undefined,
      }));
      // For each shared drive, list its root contents
      for (const d of drives) {
        const sharedDriveRes = await drive.files.list({
          pageSize: 100,
          fields: 'files(id, name, mimeType, modifiedTime, owners, shared, parents, driveId)',
          q: "'root' in parents and (mimeType='application/vnd.google-apps.folder' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.ms-excel' or mimeType='text/csv') and trashed=false",
          corpora: 'drive',
          driveId: d.id!,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        });
        const sharedFiles = (sharedDriveRes.data.files || []).filter(f => f.id && f.name).map(f => ({
          id: f.id!,
          name: f.name!,
          mimeType: f.mimeType!,
          modifiedTime: f.modifiedTime ?? undefined,
          owners: f.owners?.map(o => ({ displayName: o.displayName ?? undefined })) ?? undefined,
          shared: f.shared === true ? true : undefined,
          parents: f.parents ?? undefined,
          driveId: f.driveId ?? undefined,
        }));
        files = files.concat(sharedFiles);
      }
    } else {
      // Show all files and folders in the selected folder (works for both My Drive and shared drives)
      const res = await drive.files.list({
        pageSize: 100,
        fields: 'files(id, name, mimeType, modifiedTime, owners, shared, parents, driveId)',
        q: `('${folderId}' in parents) and (mimeType='application/vnd.google-apps.folder' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.ms-excel' or mimeType='text/csv') and trashed=false`,
        corpora: 'allDrives',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });
      files = (res.data.files || []).filter(f => f.id && f.name).map(f => ({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        modifiedTime: f.modifiedTime ?? undefined,
        owners: f.owners?.map(o => ({ displayName: o.displayName ?? undefined })) ?? undefined,
        shared: f.shared === true ? true : undefined,
        parents: f.parents ?? undefined,
        driveId: f.driveId ?? undefined,
      }));
    }
    return NextResponse.json({ files });
  } catch (err) {
    console.error('Google Drive API error:', err); // Log full error
    return NextResponse.json({ error: 'Failed to list Google Drive files', details: String(err) }, { status: 500 });
  }
} 