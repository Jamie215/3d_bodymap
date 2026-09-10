-- D1 schema for study submissions. Apply with:
--   wrangler d1 execute bodymap-submissions --remote --file=./schema.sql
-- (omit --remote to apply to the local dev database)

CREATE TABLE IF NOT EXISTS submissions (
  id                TEXT PRIMARY KEY,   -- server-generated UUID
  created_at        TEXT NOT NULL,      -- when the server received it (ISO 8601)
  start_time        TEXT,               -- payload.startTime
  completion_time   TEXT,               -- payload.completionTime
  duration_seconds  INTEGER,
  model_type        TEXT,
  total_areas       INTEGER,
  device_type       TEXT,
  operating_system  TEXT,
  browser           TEXT,
  user_agent        TEXT,
  payload_json      TEXT NOT NULL       -- full payload, image fields replaced by R2 keys
);

CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions (created_at);
