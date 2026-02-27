-- Migration: create release_snapshots table for change detection baseline.
-- Run once in the Supabase SQL editor before deploying the updated refresh.js.
--
-- Stores a single row (id=1) containing the full MS API features array.
-- The CHECK constraint enforces exactly one row.

CREATE TABLE IF NOT EXISTS release_snapshots (
  id         smallint    PRIMARY KEY DEFAULT 1,
  features   jsonb       NOT NULL,
  fetched_at timestamptz DEFAULT now(),
  CONSTRAINT single_row  CHECK (id = 1)
);

-- feature_snapshots is no longer used by refresh.js and can be archived/dropped
-- when you are confident the new approach is stable:
--   DROP TABLE feature_snapshots;
