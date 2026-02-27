-- Datafix: deduplicate feature_snapshots, keeping only the latest row per release_plan_id.
-- Run once in the Supabase SQL editor after deploying the refresh.js fix.
--
-- Safe to re-run; deletes nothing if already deduplicated.

DELETE FROM feature_snapshots
WHERE id NOT IN (
  SELECT DISTINCT ON (release_plan_id) id
  FROM feature_snapshots
  ORDER BY release_plan_id, fetched_at DESC
);
