import { NextRequest, NextResponse } from 'next/server';
import { ChatAnthropic } from '@langchain/anthropic';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';

const llm = new ChatAnthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
  model: 'claude-3-haiku-20240307',
  temperature: 0,
  maxTokens: 128,
});
const catPrompt = new PromptTemplate({
  template: 'Assign a single best-fit category or theme (e.g., Pricing, UX, Feature Request, Bug, Support, Onboarding, Performance, etc.) to the following customer feedback. Return only a JSON string.\n\nFeedback: {feedback}',
  inputVariables: ['feedback'],
});
const catChain = RunnableSequence.from([
  catPrompt,
  llm,
]);

export async function POST(req: NextRequest) {
  const { text, texts } = await req.json();
  if (!text && !texts) return NextResponse.json({ error: 'Missing text(s)' }, { status: 400 });
  const inputArr = text ? [text] : texts;
  try {
    const results = await Promise.all(inputArr.map(async (t: string) => {
      const category = await getCategoryFromLLM(t);
      return { text: t, category };
    }));
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: 'LLM categorization failed', details: String(err) }, { status: 500 });
  }
}

async function getCategoryFromLLM(text: string): Promise<string> {
  const result = await catChain.invoke({ feedback: text });
  // Try to extract JSON string from LLM response
  const textOut = typeof result === 'string' ? result : (result.text || '');
  const match = textOut.match(/"(.*?)"/);
  if (match) {
    return match[1];
  }
  throw new Error('LLM did not return a JSON string category.');
} 