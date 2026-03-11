"""
Modelos para o sistema de Recap da Aula
Registra eventos durante a aula e consolida em um recap completo.
"""
from app import db
from datetime import datetime


class LessonEvent(db.Model):
    """Log de eventos que ocorrem durante uma aula"""
    __tablename__ = 'lesson_events'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('transcription_sessions.id'), nullable=False)
    presentation_id = db.Column(db.Integer, db.ForeignKey('presentation_sessions.id'), nullable=True)

    # Tipo do evento
    event_type = db.Column(db.String(50), nullable=False)

    # Dados flexíveis do evento
    event_data = db.Column(db.JSON, default=dict)

    # Referência opcional à atividade
    activity_id = db.Column(db.Integer, db.ForeignKey('live_activities.id'), nullable=True)

    # Quem disparou
    triggered_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    occurred_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    session = db.relationship('TranscriptionSession', backref=db.backref('lesson_events', lazy=True))
    activity = db.relationship('LiveActivity', backref=db.backref('lesson_events', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'presentation_id': self.presentation_id,
            'event_type': self.event_type,
            'event_data': self.event_data,
            'activity_id': self.activity_id,
            'triggered_by': self.triggered_by,
            'occurred_at': self.occurred_at.isoformat() if self.occurred_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class LessonRecap(db.Model):
    """Recap consolidado de uma aula"""
    __tablename__ = 'lesson_recaps'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('transcription_sessions.id'), nullable=False, unique=True)
    class_subject_id = db.Column(db.Integer, db.ForeignKey('class_subjects.id'), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    title = db.Column(db.String(300), nullable=False)
    ai_summary = db.Column(db.Text, nullable=True)
    recap_data = db.Column(db.JSON, nullable=False, default=dict)

    # Status: 'generating', 'ready', 'error'
    status = db.Column(db.String(20), default='generating')

    # Compartilhamento
    shared_with_students = db.Column(db.Boolean, default=False)
    shared_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    session = db.relationship('TranscriptionSession', backref=db.backref('recap', uselist=False))
    teacher = db.relationship('User', backref=db.backref('lesson_recaps', lazy=True))

    def to_dict(self, include_events=False):
        data = {
            'id': self.id,
            'session_id': self.session_id,
            'class_subject_id': self.class_subject_id,
            'teacher_id': self.teacher_id,
            'teacher_name': self.teacher.name if self.teacher else None,
            'subject_name': self.class_subject.subject.name if self.class_subject and self.class_subject.subject else None,
            'title': self.title,
            'ai_summary': self.ai_summary,
            'recap_data': self.recap_data,
            'status': self.status,
            'shared_with_students': self.shared_with_students,
            'shared_at': self.shared_at.isoformat() if self.shared_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_events:
            events = LessonEvent.query.filter_by(session_id=self.session_id)\
                .order_by(LessonEvent.occurred_at).all()
            data['events'] = [e.to_dict() for e in events]
        return data
