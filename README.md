# Prompt Lab

Prompt Lab is a production-style frontend application built with:

- Vue 3
- TypeScript
- Vite
- Pinia
- Element Plus

It is intentionally designed as a realistic team workspace app (not a toy demo), so the codebase has enough business logic depth for substantial test work.

## Product Context

The app models a collaborative delivery workspace with:

- Dashboard overview for execution health
- Task board with workflow transitions and bulk operations
- Reports with grouped metrics and trend snapshots
- Operations center for sync, SLA checks, and dependency integrity
- Settings with theme/session/planning controls
- Tabbed navigation state tied to routes

## Why This Repo Is Good For Testing Work

The project includes branch-heavy modules that are typical in real delivery teams:

- `src/store/modules/tasks.ts`
  - workflow transitions, selection state, bulk actions, drafts, sync state
- `src/store/modules/user.ts`
  - role switching, permission checks, session hydration/persistence
- `src/store/modules/analytics.ts`
  - snapshots, trend calculations, retention behavior
- `src/utils/workflow.ts`
  - transition rules, risk scoring, SLA buckets, delivery forecast
- `src/utils/http-client.ts`
  - retries, timeout, error normalization, response parsing
- `src/utils/storage.ts`
  - namespaced drafts, TTL expiration, version guarding
- `src/utils/task.ts`
  - normalization, filtering, sorting, dependency validation
- `src/store/tabs.ts`
  - route-aware tab state and close-navigation behavior

## Current Testing Status

- Vitest infrastructure is already present (`vitest.config.ts`, `tests/setup.ts`)
- Only smoke tests are present right now
- This is a deliberate baseline so a follow-up testing prompt can add comprehensive suites
- A ready-to-use testing prompt draft is provided at `PROMPT_TESTING_TEMPLATE.md`

## Quick Start

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run build
npm run typecheck
npm run test
npm run test:run
```

## Directory

```txt
src/
  components/
  composables/
  constants/
  layout/
  mock/
  router/
  services/
  store/
  types/
  utils/
  views/
tests/
```
