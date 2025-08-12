-- Add document_type column to uploaded_files table
-- This will help categorize files as surveys, meeting notes, transcripts, etc.

-- Add the document_type column
ALTER TABLE uploaded_files 
ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) NULL;

-- Add a comment for documentation
COMMENT ON COLUMN uploaded_files.document_type IS 'Category of document: survey, meeting_note, transcript, interview, feedback_form, report, other';

-- Create an index for efficient filtering by document type
CREATE INDEX IF NOT EXISTS idx_uploaded_files_document_type 
ON uploaded_files(document_type) 
WHERE document_type IS NOT NULL;

-- Add some constraints to ensure valid document types
ALTER TABLE uploaded_files 
ADD CONSTRAINT IF NOT EXISTS chk_document_type 
CHECK (document_type IN (
    'survey', 
    'meeting_note', 
    'transcript', 
    'interview', 
    'feedback_form', 
    'report', 
    'email', 
    'chat_log', 
    'support_ticket', 
    'other'
) OR document_type IS NULL);

-- Add a default value function for auto-classification based on filename patterns
CREATE OR REPLACE FUNCTION classify_document_type(filename TEXT)
RETURNS VARCHAR(50) AS $$
BEGIN
    -- Convert filename to lowercase for pattern matching
    filename := LOWER(filename);
    
    -- Survey patterns
    IF filename LIKE '%survey%' OR filename LIKE '%questionnaire%' OR filename LIKE '%form%' THEN
        RETURN 'survey';
    END IF;
    
    -- Meeting note patterns
    IF filename LIKE '%meeting%' OR filename LIKE '%notes%' OR filename LIKE '%notion%' THEN
        RETURN 'meeting_note';
    END IF;
    
    -- Interview patterns
    IF filename LIKE '%interview%' OR filename LIKE '%conversation%' THEN
        RETURN 'interview';
    END IF;
    
    -- Transcript patterns
    IF filename LIKE '%transcript%' OR filename LIKE '%recording%' OR filename LIKE '%audio%' THEN
        RETURN 'transcript';
    END IF;
    
    -- Feedback patterns
    IF filename LIKE '%feedback%' OR filename LIKE '%review%' OR filename LIKE '%rating%' THEN
        RETURN 'feedback_form';
    END IF;
    
    -- Email patterns
    IF filename LIKE '%email%' OR filename LIKE '%mail%' OR filename LIKE '%inbox%' THEN
        RETURN 'email';
    END IF;
    
    -- Chat/Support patterns
    IF filename LIKE '%chat%' OR filename LIKE '%support%' OR filename LIKE '%ticket%' OR filename LIKE '%help%' THEN
        RETURN 'support_ticket';
    END IF;
    
    -- Report patterns
    IF filename LIKE '%report%' OR filename LIKE '%analysis%' OR filename LIKE '%summary%' THEN
        RETURN 'report';
    END IF;
    
    -- Default to 'other' if no pattern matches
    RETURN 'other';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing files with auto-classified document types
UPDATE uploaded_files 
SET document_type = classify_document_type(name)
WHERE document_type IS NULL;

-- Show the results of auto-classification
SELECT 
    document_type,
    COUNT(*) as file_count,
    ARRAY_AGG(name ORDER BY uploaded_at DESC) as example_files
FROM uploaded_files 
WHERE document_type IS NOT NULL
GROUP BY document_type
ORDER BY file_count DESC;