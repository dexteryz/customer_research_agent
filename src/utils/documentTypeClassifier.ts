/**
 * Document type classification utility
 * Automatically classifies uploaded files based on filename patterns
 */

export type DocumentType = 
  | 'survey' 
  | 'meeting_note' 
  | 'interview' 
  | 'transcript' 
  | 'feedback_form' 
  | 'email' 
  | 'support_ticket' 
  | 'report' 
  | 'other';

interface DocumentTypePattern {
  type: DocumentType;
  patterns: string[];
}

// Document type classification patterns
const DOCUMENT_TYPE_PATTERNS: DocumentTypePattern[] = [
  {
    type: 'survey',
    patterns: [
      'survey', 'questionnaire', 'form', 'poll', 'quiz', 'assessment',
      'evaluation', 'grad', 'pledge', 'response', 'submission'
    ]
  },
  {
    type: 'meeting_note',
    patterns: [
      'meeting', 'notes', 'notion', 'agenda', 'minutes', 'discussion',
      'brainstorm', 'planning', 'standup', 'sync', 'call'
    ]
  },
  {
    type: 'interview',
    patterns: [
      'interview', 'conversation', 'q&a', 'one-on-one', '1-1', 
      'user research', 'customer interview'
    ]
  },
  {
    type: 'transcript',
    patterns: [
      'transcript', 'recording', 'audio', 'video', 'call recording',
      'zoom', 'teams', 'webex', 'meet'
    ]
  },
  {
    type: 'feedback_form',
    patterns: [
      'feedback', 'review', 'rating', 'testimonial', 'comment',
      'suggestion', 'complaint', 'praise'
    ]
  },
  {
    type: 'email',
    patterns: [
      'email', 'mail', 'inbox', 'message', 'correspondence',
      'communication', 'thread'
    ]
  },
  {
    type: 'support_ticket',
    patterns: [
      'support', 'ticket', 'help', 'issue', 'bug', 'problem',
      'chat', 'live chat', 'helpdesk'
    ]
  },
  {
    type: 'report',
    patterns: [
      'report', 'analysis', 'summary', 'insights', 'dashboard',
      'metrics', 'analytics', 'data'
    ]
  }
];

/**
 * Classify document type based on filename
 */
export function classifyDocumentType(filename: string): DocumentType {
  const lowerFilename = filename.toLowerCase();
  
  // Check each document type pattern
  for (const { type, patterns } of DOCUMENT_TYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (lowerFilename.includes(pattern)) {
        return type;
      }
    }
  }
  
  return 'other';
}

/**
 * Get document type with confidence score
 */
export function classifyDocumentTypeWithConfidence(filename: string): {
  type: DocumentType;
  confidence: 'high' | 'medium' | 'low';
  matchedPattern?: string;
} {
  const lowerFilename = filename.toLowerCase();
  
  // Check each document type pattern
  for (const { type, patterns } of DOCUMENT_TYPE_PATTERNS) {
    for (const pattern of patterns) {
      if (lowerFilename.includes(pattern)) {
        // Determine confidence based on pattern specificity
        let confidence: 'high' | 'medium' | 'low' = 'medium';
        
        // High confidence patterns (very specific)
        const highConfidencePatterns = [
          'survey', 'questionnaire', 'meeting', 'interview', 'transcript',
          'notion', 'grad', 'pledge', 'feedback', 'support'
        ];
        
        // Low confidence patterns (generic)
        const lowConfidencePatterns = [
          'form', 'notes', 'data', 'file', 'document'
        ];
        
        if (highConfidencePatterns.includes(pattern)) {
          confidence = 'high';
        } else if (lowConfidencePatterns.includes(pattern)) {
          confidence = 'low';
        }
        
        return {
          type,
          confidence,
          matchedPattern: pattern
        };
      }
    }
  }
  
  return {
    type: 'other',
    confidence: 'low'
  };
}

/**
 * Get all supported document types with descriptions
 */
export function getSupportedDocumentTypes(): Array<{
  type: DocumentType;
  label: string;
  description: string;
  examples: string[];
}> {
  return [
    {
      type: 'survey',
      label: 'Survey',
      description: 'Questionnaires, forms, and assessments',
      examples: ['Customer Survey.csv', 'User Feedback Form.xlsx', 'Grad Survey.csv']
    },
    {
      type: 'meeting_note',
      label: 'Meeting Notes',
      description: 'Meeting minutes, agendas, and discussion notes',
      examples: ['Team Meeting Notes.md', 'Planning Session.txt', 'Notion Import.json']
    },
    {
      type: 'interview',
      label: 'Interview',
      description: 'Customer interviews and conversations',
      examples: ['Customer Interview #1.pdf', 'User Research Session.docx']
    },
    {
      type: 'transcript',
      label: 'Transcript',
      description: 'Audio/video transcripts and recordings',
      examples: ['Call Recording Transcript.txt', 'Zoom Meeting.pdf']
    },
    {
      type: 'feedback_form',
      label: 'Feedback',
      description: 'Reviews, ratings, and testimonials',
      examples: ['Product Reviews.csv', 'Customer Testimonials.xlsx']
    },
    {
      type: 'email',
      label: 'Email',
      description: 'Email threads and correspondence',
      examples: ['Customer Emails.mbox', 'Support Correspondence.txt']
    },
    {
      type: 'support_ticket',
      label: 'Support Ticket',
      description: 'Help desk tickets and chat logs',
      examples: ['Support Tickets.csv', 'Live Chat Log.txt']
    },
    {
      type: 'report',
      label: 'Report',
      description: 'Analysis reports and summaries',
      examples: ['Monthly Report.pdf', 'Customer Insights.docx']
    },
    {
      type: 'other',
      label: 'Other',
      description: 'Uncategorized or mixed content',
      examples: ['Mixed Data.zip', 'Unknown File.txt']
    }
  ];
}