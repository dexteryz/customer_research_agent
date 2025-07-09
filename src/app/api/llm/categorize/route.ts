import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { text, texts } = await req.json();
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Claude API key missing' }, { status: 500 });
  if (!text && !texts) return NextResponse.json({ error: 'Missing text(s)' }, { status: 400 });
  const inputArr = text ? [text] : texts;
  try {
    const results = await Promise.all(inputArr.map(async (t: string) => {
      const category = await getCategoryFromClaude(t, apiKey);
      return { text: t, category };
    }));
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: 'Claude categorization failed', details: String(err) }, { status: 500 });
  }
}

async function getCategoryFromClaude(text: string, apiKey: string): Promise<string> {
  const prompt = `Assign a single best-fit category or theme (e.g., Pricing, UX, Feature Request, Bug, Support, Onboarding, Performance, etc.) to the following customer feedback. Return only a JSON string.\n\nFeedback: ${text}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 64,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  // Try to extract JSON string from Claude's response
  // Use a regex without /s flag for compatibility
  const match = data.content?.[0]?.text?.match(/"(.*?)"/);
  if (match) {
    return match[1];
  }
  return '';
} 