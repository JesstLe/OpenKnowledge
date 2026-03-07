# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Knowledge Assistant - A local-first intelligent knowledge management and learning assistant application.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 + React 18 + shadcn/ui + Tailwind |
| Backend | FastAPI (Python) + LangChain + LiteLLM |
| Database | PostgreSQL + pgvector |
| Desktop | Tauri (future) |

## Project Structure

```
knowledgeAssistant/
├── frontend/          # Next.js frontend
│   ├── app/          # App Router pages
│   ├── components/   # React components
│   ├── lib/          # Utilities
│   ├── hooks/        # Custom hooks
│   └── stores/       # Zustand state
├── backend/          # FastAPI backend
│   ├── api/          # API routes
│   ├── services/     # Business logic
│   ├── models/       # Data models
│   └── core/         # Config/security
└── docker-compose.yml
```

## Commands

### Frontend (from frontend/)
```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run tests
```

### Backend (from backend/)
```bash
uvicorn main:app --reload    # Development server
pytest                       # Run tests
pytest --cov=app             # Tests with coverage
alembic upgrade head         # Run migrations
```

### Docker
```bash
docker-compose up -d         # Start services
docker-compose down          # Stop services
```

## Architecture

### Core Modules

1. **LLM Gateway** - Unified LLM API wrapper (OpenAI/Claude/Qwen/Ollama)
2. **RAG Engine** - Document chunking, embedding, semantic search
3. **Document Processor** - Multi-format parsing (PDF/Word/Excel/Image/AV)
4. **Memory System** - Long-term memory, learning plans, spaced repetition

### Data Flow

```
User Query → LLM Gateway → Memory Retrieval → RAG Search → Context Assembly → LLM Response
```

## Development Workflow

1. Follow TDD: Write tests first, implement, verify 80%+ coverage
2. Use `planner` agent for complex features
3. Use `code-reviewer` agent after writing code
4. Use `tdd-guide` agent for new features/bug fixes

## Key Dependencies

### Frontend
- shadcn/ui - UI components
- Zustand - State management
- React Query - Data fetching
- React Markdown - Markdown rendering

### Backend
- LangChain - LLM orchestration
- LiteLLM - Multi-provider LLM support
- Unstructured - Document parsing
- pgvector - Vector operations
