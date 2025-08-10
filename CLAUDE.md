# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development server**: `npm run dev` - Starts Next.js with Turbopack and background insights worker
- **Build project**: `npm run build` - Creates production build
- **Build scripts**: `npm run build:scripts` - Compiles TypeScript scripts to CommonJS
- **Production server**: `npm start` - Runs production build
- **Linting**: `npm run lint` - Runs Next.js ESLint checks

## Architecture Overview

This is a **Customer Research Analytics** application built with Next.js 15 and TypeScript. The system processes customer feedback through multiple channels and provides AI-powered insights via a dashboard interface.

### Core Data Flow

1. **File Upload & Processing**: Users upload CSV/Excel files or connect Google Drive documents
2. **Text Chunking & Embedding**: Content is chunked and embedded using OpenAI embeddings
3. **Vector Storage**: Embeddings stored in Supabase with pgvector for semantic search
4. **LLM Analysis**: Claude 3.5 Sonnet analyzes data to extract insights, pain points, recommendations
5. **Dashboard Visualization**: React components display analytics via charts and widgets

### Key Technology Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, LangChain for LLM orchestration
- **Database**: Supabase (PostgreSQL with pgvector extension)
- **LLM Provider**: Anthropic Claude 3.5 Sonnet via `@langchain/anthropic`
- **Embeddings**: OpenAI embeddings via `@langchain/openai`
- **Charts**: Recharts for data visualization
- **UI Components**: Radix UI primitives with custom styling

### Database Schema (Supabase)

- `uploaded_files`: File metadata and upload tracking
- `file_chunks`: Text chunks with content and metadata
- `chunk_embeddings`: Vector embeddings for semantic search
- `llm_insights`: Generated insights categorized by type (painPoint, recommendation, highlight, keyQuote)

### API Routes Architecture

**Data Management**:
- `/api/customer-data` - Fetch uploaded files and chunks
- `/api/upload` - Handle file uploads and chunking

**LLM Processing**:
- `/api/llm/unified-topic-analysis` - Unified topic analysis with LLM-powered insights, snippets, and recommendations
- `/api/llm/sentiment-over-time` - Time-series sentiment analysis

**Search & RAG**:
- `/api/rag-search` - RAG pipeline with vector search and answer synthesis
- `/api/semantic-search` - Pure vector similarity search

### Component Structure

**Main Application**: `src/app/page.tsx` contains the dashboard with CustomerDataContext for state management

**Dashboard Widgets** (`src/components/dashboard-widgets.tsx`):
- `SentimentOverTimeWidget` - Time-series sentiment chart
- `TopicAnalysisWidget` - Topic frequency chart using unified topic analysis
- `TopicInsightsWidget` - Detailed topic insights with customer quotes and recommendations (replaces separate pain points, quotes, insights, and recommendations widgets)
- `SourceBreakdownWidget` - Data source breakdown

### Background Processing

The application runs a background worker (`scripts/eval-insights-worker.ts`) alongside the dev server via `concurrently`. This worker processes LLM insights for evaluation and quality scoring.

### Environment Variables Required

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `CLAUDE_API_KEY` - Anthropic API key
- `OPENAI_API_KEY` - OpenAI API key for embeddings

### LLM Prompt Engineering

**Unified Topic Analysis** (`/api/llm/unified-topic-analysis/route.ts`):
- Uses topic-specific prompts for each business category (Pain Points, Blockers, Customer Requests, Solution Feedback)
- Each prompt is optimized for its specific topic with relevance scoring, snippet extraction, and recommendation generation
- Combines both topic frequency analysis and detailed insights in a single processing pipeline
- All results are stored in `llm_insights` table with proper categorization


### RAG Implementation

The RAG pipeline (`/api/rag-search`) combines:
1. Query embedding via OpenAI
2. Vector similarity search in Supabase using `match_chunks` RPC
3. Context assembly from retrieved chunks
4. Answer synthesis via Claude with custom prompt template

### File Processing Pipeline

1. Upload via `/api/upload` route
2. Text extraction and chunking
3. Embedding generation and storage
4. Metadata indexing for search and retrieval

The system supports CSV, Excel, and PDF files with automatic text extraction and structured data handling.