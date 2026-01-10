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

