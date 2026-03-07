# AGENTS.md

Repository guidance for autonomous coding agents working in `knowledgeAssistant`.

## 1) Scope And Priorities

- Follow this file first for repo-specific execution.
- Keep changes minimal, targeted, and consistent with nearby code.
- Do not invent tooling that is not present in this repo.
- If a command is missing, state that gap clearly instead of guessing.

## 2) Repository Layout

- `frontend/`: Next.js app (App Router, TypeScript, Tailwind, shadcn/ui style components).
- `backend/`: FastAPI service with SQLAlchemy async + pgvector.
- `docker-compose.yml`: local Postgres (pgvector image).
- `docs/`: project docs.

## 3) Environment Baseline

- Run Node/NPM commands inside `frontend/`.
- Run Python/FastAPI commands inside `backend/`.
- Run Docker commands from repo root.
- Frontend talks to backend at `http://localhost:8000` by default (`frontend/lib/api.ts`).

## 4) Scan Scope Guardrails

- Exclude generated/dependency/runtime directories when searching for tests/config/code patterns:
  - `frontend/node_modules/`
  - `frontend/.next/`
  - `backend/venv/`
  - `backend/__pycache__/`
- Prefer scanning first-party source paths (`frontend/app`, `frontend/components`, `frontend/lib`, `frontend/stores`, `backend/api`, `backend/services`, `backend/models`, `backend/core`).

## 5) Source-Of-Truth Files

- Frontend scripts: `frontend/package.json`.
- Frontend lint config: `frontend/eslint.config.mjs`.
- Frontend TS strictness and aliasing: `frontend/tsconfig.json`.
- Backend deps: `backend/requirements.txt`.
- Backend app entry: `backend/main.py`.
- DB service: `docker-compose.yml`.

## 6) Build / Lint / Test Commands

### Frontend (`frontend/`)

- Install deps: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Start built app: `npm run start`
- Lint: `npm run lint`

Frontend testing status:

- There is currently no `test` script in `frontend/package.json`.
- No frontend test framework config is present (no Jest/Vitest config in repo root or `frontend/`).
- No frontend tests are currently checked in under project source directories.

Single test (frontend):

- Not available with current repository setup.
- If tests are introduced later, document the exact runner command here.

### Backend (`backend/`)

- Create/activate venv (example): `python -m venv venv && source venv/bin/activate`
- Install deps: `pip install -r requirements.txt`
- Dev server: `uvicorn main:app --reload`
- Alternate run: `python main.py`

Backend testing status:

- `pytest` and `pytest-asyncio` are installed via `requirements.txt`.
- No `tests/` directory or checked-in test files are currently present.
- No `pytest.ini`, `pyproject.toml`, or `tox.ini` test config is present.

Single test (backend pytest syntax examples for future tests):

- Single file: `pytest tests/test_x.py -q`
- Single test function: `pytest tests/test_x.py::test_name -q`
- Single test method in class: `pytest tests/test_x.py::TestClass::test_name -q`
- These commands are examples only until backend test files are added.

### Database / Infra (repo root)

- Start Postgres: `docker-compose up -d`
- Stop services: `docker-compose down`

## 7) Formatting, Linting, And Type Checks

- Frontend linting is enforced by ESLint (`eslint-config-next` + TS rules).
- Frontend TypeScript strict mode is enabled (`"strict": true`).
- Backend has no configured lint/typecheck tools in-repo (no Ruff/Black/MyPy config files).
- Do not claim backend lint/typecheck passes unless you add and run such tooling.

## 8) Coding Style - Frontend (Observed Conventions)

- Use TypeScript interfaces/types for data shapes (`frontend/types`, `frontend/lib/api.ts`).
- Prefer functional React components; mark client components with `"use client"`.
- Prefer hooks + local state for page logic (`useState`, `useEffect`, `useRef`).
- Use `@/` path alias for internal imports (configured in `frontend/tsconfig.json`).
- Keep imports grouped: external packages, then internal aliases.
- Follow the style already present in the target file; this repo is not perfectly style-uniform.
- Avoid broad reformat-only changes in feature commits.

Naming:

- Components/pages: PascalCase component names (`ChatPage`, `RootLayout`).
- Variables/functions: camelCase (`handleSend`, `scrollToBottom`).
- Constants: UPPER_SNAKE_CASE when used for true constants (`API_BASE_URL`).
- Files: mostly lowercase and framework-conventional naming (`page.tsx`, `layout.tsx`, `button.tsx`).

UI patterns:

- Existing UI uses utility classes and shared primitives in `frontend/components/ui/*`.
- Reuse `cn()` helper from `frontend/lib/utils.ts` for class composition.
- Prefer existing component primitives before introducing new third-party UI layers.

## 9) Coding Style - Backend (Observed Conventions)

- Use async FastAPI endpoints and async SQLAlchemy sessions.
- Keep layered separation:
  - `api/` for route handlers
  - `services/` for business logic
  - `models/` for SQLAlchemy + Pydantic models
  - `core/` for settings/database wiring
- Use type hints in function signatures where present.
- Use Pydantic models for request/response contracts.
- Use service singletons (`*_service = ServiceClass()`) where existing modules do so.

Imports and naming:

- Follow Python import grouping in existing files (stdlib/third-party/local with spacing).
- Class names: PascalCase.
- Function and variable names: snake_case.
- Table and field naming follows existing SQLAlchemy model patterns.

## 10) Error Handling Conventions

Frontend:

- Async UI actions usually use `try/catch/finally`.
- Log actionable errors via `console.error` and show user-friendly UI feedback.
- Always reset loading state in `finally` when loading state is used.

Backend:

- Raise `HTTPException` in API routes for request/validation/domain failures.
- In write flows, rollback sessions on exceptions before re-raising/returning error responses.
- Preserve response shape and status behavior of neighboring endpoints.

## 11) Agent Execution Rules For This Repo

- Before editing, inspect nearby files and mirror local patterns.
- Prefer small, surgical diffs over large stylistic rewrites.
- Validate changed surface area:
  - Frontend: run `npm run lint` and relevant build/check command if touched broadly.
  - Backend: run targeted runtime/tests if tests exist; currently mostly endpoint-level smoke checks.
- If tests do not exist for the modified backend/frontend area, say so explicitly.

## 12) Rules Files Check (Cursor / Copilot)

As of current repository scan:

- No `.cursorrules` file found.
- No `.cursor/rules/` directory found.
- No `.github/copilot-instructions.md` file found.

If these files are added later, merge their requirements into this AGENTS.md and treat them as higher-priority policy inputs.

## 13) Known Documentation Drift To Keep In Mind

- `CLAUDE.md` mentions some commands/workflows that are not fully wired in code (for example frontend test command).
- `CLAUDE.md` also contains stack/version drift (for example Next.js/React versions) compared to `frontend/package.json`.
- Always verify executable commands against real config files before running or documenting.
- Prefer evidence from package/config files over prose docs when they conflict.
