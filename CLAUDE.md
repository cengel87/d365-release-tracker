# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install              # install dependencies
npm run netlify-dev      # local dev with serverless functions (preferred)
npm run dev              # Vite dev server only (no functions)
npm run build            # production build to dist/
npm run lint             # ESLint
```

There is no test suite configured.

## Architecture

**React SPA + Netlify serverless functions + Supabase Postgres.**

### Frontend (src/)

- **App.tsx** - Root component. Owns all react-query queries/mutations, tab state, and the `openDetail(id, mode)` callback that opens the feature modal.
- **types.ts** - All shared TypeScript types. `ReleaseFeature` is the raw Microsoft API shape; `EnrichedFeature` adds computed fields (status, parsed dates, daysToGA, msLink).
- **api.ts** - Thin fetch wrapper over `/.netlify/functions/*` endpoints. No direct Supabase calls from the browser.
- **logic.ts** - Pure functions: `enrich()` computes status/dates from raw features, `applyFilters()` handles multi-field filtering, date formatting helpers.
- **components/** - One file per tab (Dashboard, Features, Watchlist, Changes, Help) plus FeatureModal/FeatureDetail, Header, Tabs, Pill, IdentityGate.
- **styles.css** - All styles in one file using CSS custom properties.

### Backend (netlify/functions/)

All functions are plain CommonJS JS files (not TypeScript). They share `_util.js` which provides Supabase client init, CORS headers, and the Microsoft API fetch with in-memory caching.

- **releaseplans.js** - Proxies paginated Microsoft Release Plans API (avoids CORS). Caches in-memory with configurable TTL.
- **refresh.js** - POST-only. Fetches all features, diffs against previous full snapshot stored in `release_snapshots` table, writes change_log entries, updates the snapshot. This is the change detection engine.
- **watchlist.js** - CRUD for watchlist items (GET/POST/DELETE).
- **watchlist-impact.js**, **watchlist-flagged-for.js**, **watchlist-analysis-status.js** - Single-field update endpoints for watchlist metadata.
- **notes.js** - CRUD for notes, supports bulk fetch by comma-separated IDs.
- **changes.js** - Reads change_log filtered by day count.

### Edge Functions (netlify/edge-functions/)

- **basic-auth.ts** - Optional basic auth gate controlled by `BASIC_AUTH_CREDENTIALS` env var.

### Data Flow

1. Browser calls `/.netlify/functions/releaseplans` which proxies + caches the Microsoft API
2. Frontend `enrich()` computes status from dates, sorts by last commit date
3. Watchlist/notes/changes are read/written through their respective function endpoints to Supabase
4. "Refresh & detect changes" triggers `refresh.js` which diffs the full API response against a stored JSONB snapshot

### Database Tables (Supabase)

- `watchlist` - keyed by release_plan_id, stores impact/flagged_for/analysis_status
- `notes` - per-feature notes with author_name
- `release_snapshots` - single row (id=1) storing full API response as JSONB for diffing
- `change_log` - detected changes with change_type classification

### Environment Variables

Required in `.env` (locally) or Netlify dashboard:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Supabase connection (service role, never exposed to browser)
- `CACHE_TTL_SECONDS` (optional) - Microsoft API cache TTL, defaults to 4 hours
- `BASIC_AUTH_CREDENTIALS` (optional) - enables basic auth edge function

## Conventions

- Functional React components only
- All state management via @tanstack/react-query; no Redux or Context for data
- Pill component used for filter tags across tabs
- Git branch naming: `claude/<feature-name>`, PRs merge to `master`
- Netlify functions use CommonJS (`require`/`module.exports`), not ESM
