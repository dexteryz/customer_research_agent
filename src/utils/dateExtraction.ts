/**
 * Date extraction utilities for various data formats
 * Handles survey responses, meeting notes, feedback forms, etc.
 */

interface ExtractedDate {
  date: Date | null;
  confidence: 'high' | 'medium' | 'low';
  source: string; // Description of where the date was found
}

/**
 * Extract original creation date from content chunk
 */
export function extractOriginalDate(content: string, fileType: string, fileName?: string): ExtractedDate {
  const cleanContent = content.trim();
  
  // Try different extraction strategies based on file type and content patterns
  const strategies = [
    () => extractFromSurveyResponse(cleanContent),
    () => extractFromMeetingNotes(cleanContent),
    () => extractFromFeedbackForm(cleanContent),
    () => extractFromCSVRow(cleanContent),
    () => extractFromEmailOrMessage(cleanContent),
    () => extractFromStructuredData(cleanContent),
    () => extractFromFileName(fileName || ''),
    () => extractFromGenericPatterns(cleanContent)
  ];

  // Try each strategy and return the first high-confidence match
  for (const strategy of strategies) {
    const result = strategy();
    if (result.date && result.confidence === 'high') {
      return result;
    }
  }

  // If no high-confidence match, return the best medium-confidence match
  for (const strategy of strategies) {
    const result = strategy();
    if (result.date && result.confidence === 'medium') {
      return result;
    }
  }

  // Fall back to low-confidence matches
  for (const strategy of strategies) {
    const result = strategy();
    if (result.date) {
      return result;
    }
  }

  return { date: null, confidence: 'low', source: 'no date found' };
}

/**
 * Extract date from survey response data
 */
function extractFromSurveyResponse(content: string): ExtractedDate {
  // Common survey patterns
  const patterns = [
    /(?:response\s+date|submitted|completed|survey\s+date)[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i,
    /(?:timestamp|date)[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2}[\sT][0-9]{2}:[0-9]{2})/i,
    /(?:created|submitted)[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const date = parseDate(match[1]);
      if (date) {
        return { date, confidence: 'high', source: `survey pattern: ${match[1]}` };
      }
    }
  }

  return { date: null, confidence: 'low', source: 'no survey date pattern' };
}

/**
 * Extract date from meeting notes
 */
function extractFromMeetingNotes(content: string): ExtractedDate {
  // Meeting note patterns
  const patterns = [
    /(?:meeting\s+date|date\s+of\s+meeting|held\s+on)[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i,
    /(?:^|\n)date[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
    /(?:call\s+on|session\s+on|interview\s+on)[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i,
    /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const date = parseDate(match[1]);
      if (date) {
        return { date, confidence: 'high', source: `meeting pattern: ${match[1]}` };
      }
    }
  }

  return { date: null, confidence: 'low', source: 'no meeting date pattern' };
}

/**
 * Extract date from feedback forms
 */
function extractFromFeedbackForm(content: string): ExtractedDate {
  // Feedback form patterns
  const patterns = [
    /(?:feedback\s+date|submitted\s+on|form\s+date)[:\s]*([0-9]{1,2}[-\/][0-9]{1,2}[-\/][0-9]{2,4})/i,
    /(?:^|\n)(?:date|when)[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const date = parseDate(match[1]);
      if (date) {
        return { date, confidence: 'high', source: `feedback pattern: ${match[1]}` };
      }
    }
  }

  return { date: null, confidence: 'low', source: 'no feedback date pattern' };
}

/**
 * Extract date from CSV row data
 */
function extractFromCSVRow(content: string): ExtractedDate {
  // Look for common CSV column headers followed by date values
  const lines = content.split('\n');
  
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    
    // Check if this looks like a CSV header row
    if (line.includes(',') && (
      line.toLowerCase().includes('date') || 
      line.toLowerCase().includes('timestamp') ||
      line.toLowerCase().includes('created') ||
      line.toLowerCase().includes('submitted')
    )) {
      // Look for the date value in subsequent lines
      for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
        const dataLine = lines[j];
        const values = dataLine.split(',');
        
        for (const value of values) {
          const cleanValue = value.replace(/['"]/g, '').trim();
          const date = parseDate(cleanValue);
          if (date) {
            return { date, confidence: 'medium', source: `CSV data: ${cleanValue}` };
          }
        }
      }
    }
  }

  return { date: null, confidence: 'low', source: 'no CSV date pattern' };
}

/**
 * Extract date from email or message content
 */
function extractFromEmailOrMessage(content: string): ExtractedDate {
  // Email and message patterns
  const patterns = [
    /(?:sent|received|date)[:\s]*([A-Za-z]{3},?\s+[0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4})/i,
    /(?:on|date)[:\s]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}\s+[0-9]{1,2}:[0-9]{2})/i,
    /from:.*?([0-9]{4}-[0-9]{2}-[0-9]{2})/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const date = parseDate(match[1]);
      if (date) {
        return { date, confidence: 'medium', source: `email pattern: ${match[1]}` };
      }
    }
  }

  return { date: null, confidence: 'low', source: 'no email date pattern' };
}

/**
 * Extract date from structured data (JSON, key-value pairs)
 */
function extractFromStructuredData(content: string): ExtractedDate {
  // JSON-like or structured data patterns
  const patterns = [
    /"(?:date|timestamp|created_at|submitted_at)"[:\s]*"([^"]+)"/i,
    /(?:date|timestamp|created|submitted)[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2}[T\s][0-9]{2}:[0-9]{2})/i
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const date = parseDate(match[1]);
      if (date) {
        return { date, confidence: 'medium', source: `structured data: ${match[1]}` };
      }
    }
  }

  return { date: null, confidence: 'low', source: 'no structured date pattern' };
}

/**
 * Extract date from filename
 */
function extractFromFileName(fileName: string): ExtractedDate {
  if (!fileName) return { date: null, confidence: 'low', source: 'no filename' };

  // Filename date patterns
  const patterns = [
    /([0-9]{4}-[0-9]{2}-[0-9]{2})/,
    /([0-9]{2}-[0-9]{2}-[0-9]{4})/,
    /([0-9]{8})/,  // YYYYMMDD
    /([0-9]{6})/   // YYMMDD
  ];

  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (match) {
      const date = parseDate(match[1]);
      if (date) {
        return { date, confidence: 'medium', source: `filename: ${match[1]}` };
      }
    }
  }

  return { date: null, confidence: 'low', source: 'no filename date pattern' };
}

/**
 * Extract date using generic patterns as fallback
 */
function extractFromGenericPatterns(content: string): ExtractedDate {
  // Generic date patterns
  const patterns = [
    /([0-9]{4}-[0-9]{2}-[0-9]{2})/,
    /([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/,
    /([0-9]{1,2}-[0-9]{1,2}-[0-9]{4})/,
    /([A-Za-z]{3}\s+[0-9]{1,2},?\s+[0-9]{4})/
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const date = parseDate(match[1]);
      if (date && isReasonableDate(date)) {
        return { date, confidence: 'low', source: `generic pattern: ${match[1]}` };
      }
    }
  }

  return { date: null, confidence: 'low', source: 'no generic date pattern' };
}

/**
 * Parse various date formats into a Date object
 */
function parseDate(dateString: string): Date | null {
  if (!dateString) return null;

  const cleanDate = dateString.trim();
  
  // Try different parsing approaches
  const parseAttempts = [
    () => new Date(cleanDate),
    () => {
      // Handle MM/DD/YYYY format
      const match = cleanDate.match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/);
      if (match) {
        return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
      }
      return null;
    },
    () => {
      // Handle YYYYMMDD format
      const match = cleanDate.match(/^([0-9]{4})([0-9]{2})([0-9]{2})$/);
      if (match) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      }
      return null;
    },
    () => {
      // Handle DD-MM-YYYY format
      const match = cleanDate.match(/^([0-9]{1,2})-([0-9]{1,2})-([0-9]{4})$/);
      if (match) {
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      }
      return null;
    }
  ];

  for (const attempt of parseAttempts) {
    try {
      const date = attempt();
      if (date && !isNaN(date.getTime()) && isReasonableDate(date)) {
        return date;
      }
    } catch {
      // Continue to next attempt
    }
  }

  return null;
}

/**
 * Check if a date is reasonable (not too far in past/future)
 */
function isReasonableDate(date: Date): boolean {
  const now = new Date();
  const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
  const oneYearFuture = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  
  return date >= tenYearsAgo && date <= oneYearFuture;
}

/**
 * Batch extract dates from multiple content chunks
 */
export function batchExtractDates(
  chunks: Array<{ content: string; id: string }>, 
  fileType: string, 
  fileName?: string
): Array<{ id: string; extractedDate: ExtractedDate }> {
  return chunks.map(chunk => ({
    id: chunk.id,
    extractedDate: extractOriginalDate(chunk.content, fileType, fileName)
  }));
}