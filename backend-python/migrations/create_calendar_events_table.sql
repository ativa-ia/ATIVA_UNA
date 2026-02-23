CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_type VARCHAR(20) NOT NULL DEFAULT 'event',
    target_role VARCHAR(20) NOT NULL DEFAULT 'both',
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS ix_calendar_events_event_date ON calendar_events (event_date);
