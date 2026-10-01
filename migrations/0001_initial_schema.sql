-- 0001_initial_schema: bang cua APP (ghi boi POST /api/events va dang nhap).
-- Thiet ke + ly do: docs/d1-schema-design.md muc 3. KHONG pha huy: chi CREATE, khong DROP.
-- WITHOUT ROWID + 3 index: moi event ghi ton (1 + 3) luot ghi trong han muc 100k/ngay cua goi Free.

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  flow TEXT NOT NULL CHECK (flow IN ('ride', 'food', 'none')),
  event_name TEXT NOT NULL,
  screen_name TEXT NOT NULL,
  previous_screen TEXT,
  step_index INTEGER NOT NULL CHECK (step_index >= 0),
  properties TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(properties)),
  platform TEXT NOT NULL DEFAULT 'web',
  created_at TEXT NOT NULL,
  seed_batch TEXT
) WITHOUT ROWID;

CREATE INDEX idx_events_created_at      ON events (created_at, id);
CREATE INDEX idx_events_session_step    ON events (session_id, step_index);
CREATE INDEX idx_events_user_created_at ON events (user_id, created_at);

CREATE TABLE users (
  phone TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
) WITHOUT ROWID;
