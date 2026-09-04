-- The sync mirror.
--
-- This database is not the source of truth. Every device holds the real log in
-- IndexedDB and can run the whole app with the network off; these tables exist
-- only so a second device can catch up, and so one daily push can be sent.
--
-- Only the immutable event log is mirrored. Derived state (level, XP, stats,
-- rank, fatigue) is never stored here, because every device recomputes it from
-- the log and storing it would create a second, disagreeing truth.

-- One row per hunter. The id is SHA-256 of the Hunter Secret, hex encoded, so
-- this table never contains anything that can be replayed as a credential.
CREATE TABLE IF NOT EXISTS hunters (
  hunter_id     TEXT PRIMARY KEY,
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL
) STRICT;

-- The mirrored log, append-only.
--
-- `seq` is a single global autoincrementing column rather than a per-hunter
-- counter. Scoped to one hunter it is still strictly increasing, which is all
-- the client cursor needs, and it avoids a read-modify-write race on a counter
-- for the sake of numbers nobody ever sees.
CREATE TABLE IF NOT EXISTS events (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  hunter_id   TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('session', 'set', 'bodyMetric')),
  row_id      TEXT NOT NULL,
  -- The row as JSON. Never logged, because it carries health data.
  payload     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  -- The same row pushed twice must not produce two mirror rows, which is what
  -- makes a retry after a dropped connection safe.
  UNIQUE (hunter_id, kind, row_id)
) STRICT;

CREATE INDEX IF NOT EXISTS events_hunter_seq ON events (hunter_id, seq);

-- Web push subscriptions, one or more per hunter (a phone and a tablet).
-- The daily nudge fires from one cron expression, deploy-wide, so there is no
-- per-device local time to store here.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint       TEXT PRIMARY KEY,
  hunter_id      TEXT NOT NULL,
  p256dh         TEXT NOT NULL,
  auth           TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  -- A push service returning 404 or 410 means the subscription is dead.
  failure_count  INTEGER NOT NULL DEFAULT 0,
  last_sent_at   INTEGER
) STRICT;

CREATE INDEX IF NOT EXISTS push_by_hunter ON push_subscriptions (hunter_id);

-- Rate limiting lives here rather than in Workers KV, because the free KV
-- allowance is 1,000 writes a day and a rate limiter writes on every request.
-- D1 allows 100,000 writes a day on the same plan.
CREATE TABLE IF NOT EXISTS rate_limits (
  hunter_id     TEXT NOT NULL,
  -- Start of the fixed window, as a unix epoch second.
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL,
  PRIMARY KEY (hunter_id, window_start)
) STRICT;
