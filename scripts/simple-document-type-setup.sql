-- Simple SQL script to add document_type column and classify existing files
-- Run this directly in Supabase SQL Editor

-- Step 1: Add the document_type column
ALTER TABLE uploaded_files 
ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) NULL;

-- Step 2: Add index for performance
CREATE INDEX IF NOT EXISTS idx_uploaded_files_document_type 
ON uploaded_files(document_type);

-- Step 3: Classify existing files based on filename patterns
UPDATE uploaded_files 
SET document_type = CASE
    -- Survey patterns
    WHEN LOWER(name) LIKE '%survey%' OR LOWER(name) LIKE '%questionnaire%' OR LOWER(name) LIKE '%form%' 
         OR LOWER(name) LIKE '%grad%' OR LOWER(name) LIKE '%pledge%' THEN 'survey'
    
    -- Meeting note patterns
    WHEN LOWER(name) LIKE '%meeting%' OR LOWER(name) LIKE '%notes%' OR LOWER(name) LIKE '%notion%'
         OR LOWER(name) LIKE '%minutes%' OR LOWER(name) LIKE '%agenda%' THEN 'meeting_note'
    
    -- Interview patterns
    WHEN LOWER(name) LIKE '%interview%' OR LOWER(name) LIKE '%conversation%' THEN 'interview'
    
    -- Transcript patterns
    WHEN LOWER(name) LIKE '%transcript%' OR LOWER(name) LIKE '%recording%' OR LOWER(name) LIKE '%audio%' THEN 'transcript'
    
    -- Feedback patterns
    WHEN LOWER(name) LIKE '%feedback%' OR LOWER(name) LIKE '%review%' OR LOWER(name) LIKE '%rating%' THEN 'feedback_form'
    
    -- Email patterns
    WHEN LOWER(name) LIKE '%email%' OR LOWER(name) LIKE '%mail%' OR LOWER(name) LIKE '%inbox%' THEN 'email'
    
    -- Support patterns
    WHEN LOWER(name) LIKE '%support%' OR LOWER(name) LIKE '%ticket%' OR LOWER(name) LIKE '%chat%' THEN 'support_ticket'
    
    -- Report patterns
    WHEN LOWER(name) LIKE '%report%' OR LOWER(name) LIKE '%analysis%' OR LOWER(name) LIKE '%summary%' THEN 'report'
    
    -- Default
    ELSE 'other'
END
WHERE document_type IS NULL;

-- Step 4: View the results
SELECT 
    document_type,
    COUNT(*) as file_count,
    STRING_AGG(name, ', ' ORDER BY uploaded_at DESC) as example_files
FROM uploaded_files 
GROUP BY document_type
ORDER BY file_count DESC;

-- Step 5: Show specific classifications for review
SELECT 
    name,
    document_type,
    type as file_type,
    uploaded_at
FROM uploaded_files
ORDER BY document_type, uploaded_at DESC;