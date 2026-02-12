# D365 & Power Platform Release Tracker (Netlify + Supabase)

A maintainable rewrite of your Streamlit concept:
- **Static React app** (Vite) deployable on **Netlify** in minutes
- **Serverless functions** on Netlify for:
  - Microsoft Release Plans API proxy (avoids CORS, adds caching)
  - Watchlist (team-shared) + Impact assessment
  - Notes
  - Change detection (snapshots + change log), run on-demand
- **Supabase Postgres** (free tier) as the database

## What we kept (highest value)
- ✅ **Watchlist + impact assessment** (key feature)
- ✅ **Team notes** on watched items
- ✅ **Meaningful visuals**:
  - Upcoming GA features by **month**
  - Release Wave “channel” view with monthly GA volume
- ✅ **Accurate data**: fetched live from Microsoft Release Plans feed each refresh
- ✅ **Raw JSON** displayed for transparency
- ✅ **Deep-link to Microsoft** per feature
- ❌ Removed: **Saved Views** (per your request)

---

## 1) Prereqs
- Node.js 18+ (Netlify uses Node 18/20)
- A free Supabase project
- A free Netlify account

---

## 2) Supabase setup (database)

1. Create a Supabase project
2. In Supabase: **SQL Editor → New query**
3. Paste and run:

```sql
-- WATCHLIST (team shared)
create table if not exists watchlist (
  release_plan_id text primary key,
  feature_name text not null,
  product_name text not null,
  impact text not null default '🚩 To Review',
  added_at timestamptz not null default now()
);

-- NOTES (simple: name stored as text)
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  release_plan_id text not null,
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- SNAPSHOTS (raw Microsoft record stored as JSONB)
create table if not exists feature_snapshots (
  id uuid primary key default gen_random_uuid(),
  release_plan_id text not null,
  snapshot_data jsonb not null,
  fetched_at timestamptz not null default now()
);

create index if not exists feature_snapshots_rpid_idx
  on feature_snapshots (release_plan_id, fetched_at desc);

-- CHANGE LOG
create table if not exists change_log (
  id uuid primary key default gen_random_uuid(),
  release_plan_id text not null,
  feature_name text not null,
  product_name text not null,
  change_type text not null,
  field_changed text null,
  old_value text null,
  new_value text null,
  detected_at timestamptz not null default now()
);

create index if not exists change_log_detected_idx
  on change_log (detected_at desc);
```

> **Security note (recommended):** This app uses the **Supabase Service Role key** in Netlify Functions,
> so the browser never sees any keys. Keep that key secret.

---

## 3) Configure environment variables (Netlify)

In Netlify:
- Site → **Site configuration → Environment variables**
Add:

Locally, create `.env` from `.env.example` (same variable names).

---

## 4) Run locally

```bash
npm install
npm run dev
```

To run functions locally too (recommended):
```bash
npm i -g netlify-cli
netlify dev
```

---

## 5) Deploy to Netlify (fastest path)

**Option A (drag & drop)**
1. `npm run build`
2. Drag the `dist/` folder into Netlify “Deploy manually”
3. Then add environment variables + redeploy

**Option B (Git, recommended)**
1. Push this repo to GitHub
2. Netlify → “Add new site” → “Import an existing project”
3. Build command: `npm run build`
4. Publish dir: `dist`
5. Set env vars
6. Deploy

---

## 6) How change detection works

Click **“Refresh & detect changes”** in the UI:
- Netlify function fetches the Microsoft feed
- For each feature:
  - saves a snapshot (JSON)
  - compares tracked fields vs latest snapshot
  - logs changes into `change_log`

Tracked fields are in `netlify/functions/refresh.js`.

---

## Troubleshooting
- **Supabase env vars missing** → functions will return 500 with a clear message.
- **Microsoft feed temporary issues** → the UI will show fetch errors; try again later.
- **Slow refresh**: the first refresh may insert lots of snapshots.

---

## License
MIT (do what you want).
