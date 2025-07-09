import { NextRequest, NextResponse } from 'next/server';

// In-memory store for MVP
let customerData: Record<string, string>[] = [];

export async function GET() {
  return NextResponse.json({ data: customerData });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
  }
  customerData = body;
  return NextResponse.json({ success: true });
} 