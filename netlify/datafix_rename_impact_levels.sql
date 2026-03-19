-- Datafix: Rename impact levels to new legend
-- 🔴 High → 🔴 Mitigation Required
-- 🟡 Medium → 🟡 Minor Impact
-- 🟢 Low → 🟢 No Impact
-- 🚩 To Review (unchanged)
--
-- Run against Supabase SQL Editor

BEGIN;

UPDATE watchlist SET impact = '🔴 Mitigation Required' WHERE impact = '🔴 High';
UPDATE watchlist SET impact = '🟡 Minor Impact'        WHERE impact = '🟡 Medium';
UPDATE watchlist SET impact = '🟢 No Impact'           WHERE impact = '🟢 Low';

COMMIT;
