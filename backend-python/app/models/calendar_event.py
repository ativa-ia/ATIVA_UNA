from datetime import datetime
from app import db


class CalendarEvent(db.Model):
    __tablename__ = 'calendar_events'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(160), nullable=False)
    description = db.Column(db.Text, nullable=True)
    event_date = db.Column(db.Date, nullable=False, index=True)
    event_type = db.Column(db.String(20), nullable=False, default='event')  # event | notice
    target_role = db.Column(db.String(20), nullable=False, default='both')   # student | teacher | both
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'event_date': self.event_date.isoformat() if self.event_date else None,
            'event_type': self.event_type,
            'target_role': self.target_role,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_active': self.is_active,
        }
