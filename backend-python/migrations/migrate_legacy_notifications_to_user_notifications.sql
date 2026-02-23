-- Migra dados da tabela legacy notifications para user_notifications
-- Seguro para reexecução por usar NOT EXISTS

INSERT INTO user_notifications (
    recipient_user_id,
    title,
    message,
    type,
    subject_name,
    source_type,
    source_id,
    created_at
)
SELECT
    e.student_id,
    n.title,
    n.message,
    COALESCE(n.type, 'general') AS type,
    s.name AS subject_name,
    'legacy_notification' AS source_type,
    n.id AS source_id,
    COALESCE(n.created_at, NOW()) AS created_at
FROM notifications n
JOIN enrollments e ON e.subject_id = n.subject_id
LEFT JOIN subjects s ON s.id = n.subject_id
WHERE NOT EXISTS (
    SELECT 1
    FROM user_notifications un
    WHERE un.recipient_user_id = e.student_id
      AND un.source_type = 'legacy_notification'
      AND un.source_id = n.id
);
