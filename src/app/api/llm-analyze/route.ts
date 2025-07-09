import { NextRequest, NextResponse } from 'next/server';
import { ChatAnthropic } from '@langchain/anthropic';
import { RunnableSequence } from '@langchain/core/runnables';
import { PromptTemplate } from '@langchain/core/prompts';

const llm = new ChatAnthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
  model: 'claude-3-5-sonnet-20240620',
  temperature: 0,
  maxTokens: 1024,
});

export async function POST(req: NextRequest) {
  const { data, mode } = await req.json();
  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ painPoints: [], keyQuotes: [], actionableInsights: [], recommendations: [], highlights: [] });
  }
  let promptType = 'painPoints';
  if (mode === 'insights') promptType = 'insights';
  else if (mode === 'highlights') promptType = 'highlights';
  else if (mode === 'recommendations') promptType = 'recommendations';

  // Use PromptTemplate for each mode
  const promptTemplates: Record<string, PromptTemplate> = {
    insights: new PromptTemplate({
      template: `You are a customer research analyst. Given the following customer feedback data, extract 5 actionable insights (as a list of short, specific, and actionable statements).\n\nData:\n{data}\n\nReturn JSON: {{ actionableInsights: string[] }}`,
      inputVariables: ['data'],
    }),
    recommendations: new PromptTemplate({
      template: `You are a customer research analyst. Given the following customer feedback data, generate 5 product or business recommendations (as a list of short, specific, and actionable suggestions).\n\nData:\n{data}\n\nReturn JSON: {{ recommendations: string[] }}`,
      inputVariables: ['data'],
    }),
    highlights: new PromptTemplate({
      template: `You are a customer research analyst. Given the following customer feedback data, summarize the 5 most important findings or themes from this data (as a list of concise, high-level highlights).\n\nData:\n{data}\n\nReturn JSON: {{ highlights: string[] }}`,
      inputVariables: ['data'],
    }),
    painPoints: new PromptTemplate({
      template: `You are a customer research analyst. Given the following customer feedback data, extract the top 5 customer pain points (as a list of short phrases) and 3 key representative quotes (as direct quotes from the data).\n\nData:\n{data}\n\nReturn JSON: {{ painPoints: string[], keyQuotes: string[] }}`,
      inputVariables: ['data'],
    }),
  };

  const chain = RunnableSequence.from([
    promptTemplates[promptType],
    llm,
  ]);
  try {
    const result = await chain.invoke({ data: JSON.stringify(data) });
    // Try to extract JSON from LLM response
    let parsed: {
      painPoints?: string[];
      keyQuotes?: string[];
      actionableInsights?: string[];
      recommendations?: string[];
      highlights?: string[];
    } = {};
    try {
      // result could be string or object depending on LLM output
      const text = typeof result === 'string' ? result : (result.text || '');
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch {}
    return NextResponse.json({
      painPoints: parsed.painPoints || [],
      keyQuotes: parsed.keyQuotes || [],
      actionableInsights: parsed.actionableInsights || [],
      recommendations: parsed.recommendations || [],
      highlights: parsed.highlights || [],
    });
  } catch {
    return NextResponse.json({ painPoints: [], keyQuotes: [], actionableInsights: [], recommendations: [], highlights: [] });
  }
} 