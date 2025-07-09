import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
    console.log('Incoming /api/llm/tag request body:', JSON.stringify(body));
  } catch (err) {
    console.error('Failed to parse request body:', err);
    return NextResponse.json({ error: 'Invalid JSON in request body', details: String(err) }, { status: 400 });
  }
  const { text, texts } = body;
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.error('Claude API key missing');
    return NextResponse.json({ error: 'Claude API key missing' }, { status: 500 });
  }
  if (!text && !texts) {
    console.error('Missing text(s) in request');
    return NextResponse.json({ error: 'Missing text(s)' }, { status: 400 });
  }
  const inputArr = text ? [text] : texts;
  try {
    const results = await Promise.all(inputArr.map(async (t: string) => {
      const tags = await getTagsFromClaude(t, apiKey);
      return { text: t, tags };
    }));
    return NextResponse.json({ results });
  } catch (err) {
    console.error('Claude tagging failed:', err);
    return NextResponse.json({ error: 'Claude tagging failed', details: String(err) }, { status: 500 });
  }
}

async function getTagsFromClaude(text: string, apiKey: string): Promise<string[]> {
  const prompt = `Extract 3-7 relevant tags (topics, themes, product areas, sentiment) from the following customer feedback.\n\nReturn only a JSON array of strings, with no explanation or extra text.\n\nFeedback: ${text}`;
  const payload = {
    model: 'claude-3-haiku-20240307',
    max_tokens: 128,
    messages: [{ role: 'user', content: prompt }],
  };
  console.log('Claude API request payload:', JSON.stringify(payload));
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  console.log('Claude API response status:', res.status);
  console.log('Claude API response headers:', JSON.stringify(Object.fromEntries(res.headers.entries())));
  const data = await res.json();
  console.log('Claude tag LLM response:', JSON.stringify(data));
  // Try to extract JSON array from Claude's response
  // Use a regex without /s flag for compatibility
  const match = data.content?.[0]?.text?.match(/\[[\s\S]*\]/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (err) {
      console.error('Failed to parse JSON array from Claude response:', err, match[0]);
    }
  }
  // If not found, log the full response for debugging
  console.error('No JSON array found in Claude response:', data.content?.[0]?.text);
  throw new Error('Claude did not return a JSON array of tags.');
} 