# Scripts Directory

This directory contains maintenance and utility scripts for the Customer Research Agent application.

## 🔧 Utility Scripts

### **check-progress.ts**
Monitor date extraction and document classification progress.
```bash
npx tsx scripts/check-progress.ts
```

### **propagate-file-dates.ts** 
Propagate dates within files (useful for meeting notes where all chunks should share the same date).
```bash
npx tsx scripts/propagate-file-dates.ts
```

### **classify-document-types.ts**
Classify existing files by document type (survey, meeting_note, interview, etc.).
```bash
npx tsx scripts/classify-document-types.ts
```

## 📄 SQL Scripts

### **simple-document-type-setup.sql**
Quick SQL script to add document_type column and classify existing files.
- Run directly in Supabase SQL Editor
- Adds column, index, and auto-classifies files

### **add-document-type-column.sql**
Advanced SQL setup with custom functions and constraints.
- More comprehensive than simple setup
- Includes validation and custom classification functions

## ⚙️ Background Workers

### **eval-insights-worker.ts**
Background worker for processing LLM insights and evaluations.
- Runs alongside dev server via `npm run dev`
- Handles evaluation scoring and quality metrics

## 🗑️ Removed Scripts

The following scripts were used for initial setup and are no longer needed:
- `backfill-*.ts` - One-time date extraction scripts (completed)
- `analyze-file-dates.ts` - Analysis script for backfill planning (completed)
- `finish-date-extraction.ts` - Final extraction script (completed)
- `add-original-date-column.ts` - Database migration script (completed)

## 🎯 Usage Notes

- **Progress Monitoring**: Run `check-progress.ts` to see current date extraction status
- **File Consistency**: Run `propagate-file-dates.ts` if you notice files with partial date extraction
- **Document Classification**: New uploads are auto-classified, but use `classify-document-types.ts` for existing files
- **Database Setup**: Use the SQL scripts for initial database schema setup