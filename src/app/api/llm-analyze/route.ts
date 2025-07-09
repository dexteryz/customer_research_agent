import { NextRequest, NextResponse } from 'next/server';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '***REMOVED***';

export async function POST(req: NextRequest) {
  const { data, mode } = await req.json();
  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ painPoints: [], keyQuotes: [], actionableInsights: [], recommendations: [] });
  }

  let prompt = '';
  let responseFields = {};
  if (mode === 'insights') {
    prompt = `You are a customer research analyst. Given the following customer feedback data, extract 5 actionable insights (as a list of short, specific, and actionable statements).\n\nData:\n${JSON.stringify(data)}\n\nReturn JSON: { actionableInsights: string[] }`;
    responseFields = { actionableInsights: [
      'Improve onboarding flow to reduce confusion.',
      'Add more integrations with popular tools.',
      'Lower pricing or offer more value at current price.',
      'Expand feature set based on user requests.',
      'Speed up customer support response times.',
    ] };
  } else if (mode === 'recommendations') {
    prompt = `You are a customer research analyst. Given the following customer feedback data, generate 5 product or business recommendations (as a list of short, specific, and actionable suggestions).\n\nData:\n${JSON.stringify(data)}\n\nReturn JSON: { recommendations: string[] }`;
    responseFields = { recommendations: [
      'Launch a guided onboarding tutorial.',
      'Integrate with Zapier and Slack.',
      'Introduce a lower-cost plan for small teams.',
      'Prioritize development of most-requested features.',
      'Implement live chat support.',
    ] };
  } else if (mode === 'highlights') {
    prompt = `You are a customer research analyst. Given the following customer feedback data, summarize the 5 most important findings or themes from this data (as a list of concise, high-level highlights).\n\nData:\n${JSON.stringify(data)}\n\nReturn JSON: { highlights: string[] }`;
    responseFields = { highlights: [
      'Users are confused by onboarding.',
      'Desire for more integrations.',
      'Pricing is a common concern.',
      'Requests for additional features.',
      'Support response times are slow.',
    ] };
  } else {
    prompt = `You are a customer research analyst. Given the following customer feedback data, extract the top 5 customer pain points (as a list of short phrases) and 3 key representative quotes (as direct quotes from the data).\n\nData:\n${JSON.stringify(data)}\n\nReturn JSON: { painPoints: string[], keyQuotes: string[] }`;
    responseFields = {
      painPoints: [
        'Onboarding is confusing',
        'Lack of integrations',
        'Too expensive',
        'Missing features',
        'Slow support',
      ],
      keyQuotes: [
        '“I wish the onboarding was easier.”',
        '“It’s too expensive for what you get.”',
        '“I need more integrations with my tools.”',
      ],
    };
  }

  if (CLAUDE_API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1024,
          messages: [
            { role: 'user', content: prompt },
          ],
        }),
      });
      const json = await res.json();
      let result: Record<string, unknown> = {};
      try {
        const match = json.content?.[0]?.text?.match(/\{[\s\S]*\}/);
        if (match) {
          result = JSON.parse(match[0]);
        }
      } catch {}
      // Always return all fields for frontend compatibility
      return NextResponse.json({
        painPoints: result.painPoints || [],
        keyQuotes: result.keyQuotes || [],
        actionableInsights: result.actionableInsights || [],
        recommendations: result.recommendations || [],
        highlights: result.highlights || [],
      });
    } catch {
      return NextResponse.json({ ...responseFields });
    }
  } else {
    return NextResponse.json({ ...responseFields });
  }
} 