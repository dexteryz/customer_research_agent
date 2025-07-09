import { NextRequest, NextResponse } from 'next/server';
import { ChatAnthropic } from '@langchain/anthropic';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';

const llm = new ChatAnthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
  model: 'claude-3-haiku-20240307',
  temperature: 0,
  maxTokens: 256,
});
const tagPrompt = new PromptTemplate({
  template: 'Extract 3-7 relevant tags (topics, themes, product areas, sentiment) from the following customer feedback. Return only a JSON array of strings, with no explanation or extra text.\n\nFeedback: {feedback}',
  inputVariables: ['feedback'],
});
const tagChain = RunnableSequence.from([
  tagPrompt,
  llm,
]);

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON in request body', details: String(err) }, { status: 400 });
  }
  const { text, texts } = body;
  if (!text && !texts) {
    return NextResponse.json({ error: 'Missing text(s)' }, { status: 400 });
  }
  const inputArr = text ? [text] : texts;
  try {
    const results = await Promise.all(inputArr.map(async (t: string) => {
      const tags = await getTagsFromLLM(t);
      return { text: t, tags };
    }));
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: 'LLM tagging failed', details: String(err) }, { status: 500 });
  }
}

async function getTagsFromLLM(text: string): Promise<string[]> {
  const result = await tagChain.invoke({ feedback: text });
  // Try to extract JSON array from LLM response
  try {
    // result could be string or object depending on LLM output
    const textOut = typeof result === 'string' ? result : (result.text || '');
    const match = textOut.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch {}
  throw new Error('LLM did not return a JSON array of tags.');
} 