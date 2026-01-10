-- Push Subscriptions Table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_sent_at TEXT,
    active INTEGER DEFAULT 1
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_active_subscriptions ON push_subscriptions(active);

-- Mission Completions Table (for the world map)
CREATE TABLE IF NOT EXISTS mission_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_text TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    city TEXT,
    country TEXT,
    completed_at TEXT DEFAULT (datetime('now')),
    anonymous_id TEXT  -- Optional: to prevent duplicates from same user/day
);

-- Index for fetching recent completions and location queries
CREATE INDEX IF NOT EXISTS idx_completions_date ON mission_completions(completed_at);
CREATE INDEX IF NOT EXISTS idx_completions_location ON mission_completions(latitude, longitude);

