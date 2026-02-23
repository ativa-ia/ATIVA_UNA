CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    recipient_user_id INTEGER NOT NULL,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'general',
    subject_name VARCHAR(160),
    source_type VARCHAR(50),
    source_id INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (recipient_user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS ix_user_notifications_recipient_user_id ON user_notifications (recipient_user_id);
CREATE INDEX IF NOT EXISTS ix_user_notifications_created_at ON user_notifications (created_at);
