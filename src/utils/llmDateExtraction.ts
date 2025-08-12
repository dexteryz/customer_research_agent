/**
 * LLM-based date extraction for customer feedback data
 * Uses Claude to intelligently extract original creation dates from content
 */

import { ChatAnthropic } from '@langchain/anthropic';

interface LLMExtractedDate {
  date: string | null; // ISO string format
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

/**
 * Extract original creation date from content using LLM
 */
export async function extractDateWithLLM(content: string, fileName?: string): Promise<LLMExtractedDate> {
  if (!process.env.CLAUDE_API_KEY) {
    console.log('Claude API key not found, skipping LLM date extraction');
    return { date: null, confidence: 'low', reasoning: 'No API key available' };
  }

  try {
    const model = new ChatAnthropic({
      apiKey: process.env.CLAUDE_API_KEY,
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.1
    });

    const prompt = `Extract the original creation date from this customer feedback content. This could be:

- Survey response submission date
- Meeting or interview date  
- Feedback form completion date
- Email or message timestamp
- Any other date indicating when this feedback was originally created/collected

CONTENT:
"${content}"

${fileName ? `FILENAME: ${fileName}` : ''}

INSTRUCTIONS:
1. Look for explicit dates in the content (timestamps, form dates, meeting dates, etc.)
2. Identify patterns like "submitted on", "date:", "meeting on", etc.
3. Consider the context - is this a survey response, meeting note, email, etc.?
4. If multiple dates exist, choose the most relevant original creation date
5. Ignore processing dates, system dates, or future dates

RESPONSE FORMAT (JSON only):
{
  "date": "YYYY-MM-DD" or null,
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation of how you found the date"
}

CONFIDENCE LEVELS:
- high: Clear, unambiguous date found with explicit context
- medium: Date found but some ambiguity in context or format
- low: Weak signals or uncertain date extraction

If no meaningful original date can be found, return null for date.`;

    const response = await model.invoke([{ 
      role: 'user', 
      content: prompt 
    }]);
    
    const responseText = (response as { content: { toString(): string } }).content.toString().trim();
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]) as LLMExtractedDate;
      
      // Validate the date format if provided
      if (result.date) {
        const parsedDate = new Date(result.date);
        if (isNaN(parsedDate.getTime())) {
          return { date: null, confidence: 'low', reasoning: 'Invalid date format returned by LLM' };
        }
        
        // Check if date is reasonable (within last 10 years, not future)
        const now = new Date();
        const tenYearsAgo = new Date(now.getFullYear() - 10, 0, 1);
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        if (parsedDate < tenYearsAgo || parsedDate > tomorrow) {
          return { 
            date: null, 
            confidence: 'low', 
            reasoning: `Date ${result.date} is outside reasonable range (${tenYearsAgo.getFullYear()}-${now.getFullYear()})` 
          };
        }
      }
      
      return result;
    } else {
      console.log('Could not parse LLM response for date extraction:', responseText);
      return { date: null, confidence: 'low', reasoning: 'Could not parse LLM response' };
    }
    
  } catch (error) {
    console.error('Error in LLM date extraction:', error);
    return { date: null, confidence: 'low', reasoning: `LLM extraction error: ${String(error)}` };
  }
}

/**
 * Batch extract dates from multiple content chunks using LLM
 */
export async function batchExtractDatesWithLLM(
  chunks: Array<{ content: string; id: string }>, 
  fileName?: string,
  batchSize: number = 3
): Promise<Array<{ id: string; extractedDate: LLMExtractedDate }>> {
  const results: Array<{ id: string; extractedDate: LLMExtractedDate }> = [];
  
  // Process in batches to avoid rate limits and improve performance
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(`Processing date extraction batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
    
    // Process batch in parallel
    const batchPromises = batch.map(async (chunk) => ({
      id: chunk.id,
      extractedDate: await extractDateWithLLM(chunk.content, fileName)
    }));
    
    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to be respectful to API
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Error processing date extraction batch ${Math.floor(i / batchSize) + 1}:`, error);
      // Add empty results for failed batch
      batch.forEach(chunk => {
        results.push({
          id: chunk.id,
          extractedDate: { date: null, confidence: 'low', reasoning: 'Batch processing error' }
        });
      });
    }
  }
  
  return results;
}

/**
 * Extract date from a single chunk with timeout
 */
export async function extractDateWithTimeout(
  content: string, 
  fileName?: string, 
  timeoutMs: number = 30000
): Promise<LLMExtractedDate> {
  const timeoutPromise = new Promise<LLMExtractedDate>((_, reject) =>
    setTimeout(() => reject(new Error('Date extraction timeout')), timeoutMs)
  );
  
  try {
    return await Promise.race([
      extractDateWithLLM(content, fileName),
      timeoutPromise
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Date extraction timeout') {
      return { date: null, confidence: 'low', reasoning: 'Extraction timed out' };
    }
    throw error;
  }
}