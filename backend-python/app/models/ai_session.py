"""
Modelo para sessões de chat com IA
"""
from datetime import datetime
from app import db


class AISession(db.Model):
    """Sessão de chat com IA"""
    __tablename__ = 'ai_sessions'

    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='active')  # active, ended

    # Relacionamentos
    subject = db.relationship('Subject', backref=db.backref('ai_sessions', lazy=True))
    teacher = db.relationship('User', backref=db.backref('ai_sessions', lazy=True))
    messages = db.relationship('AIMessage', backref='session', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'subject_id': self.subject_id,
            'teacher_id': self.teacher_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'status': self.status
        }


class AIMessage(db.Model):
    """Mensagem individual no chat com IA"""
    __tablename__ = 'ai_messages'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('ai_sessions.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # user, assistant
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'role': self.role,
            'content': self.content,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class AIContextFile(db.Model):
    """Arquivo de contexto enviado pelo professor"""
    __tablename__ = 'ai_context_files'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('ai_sessions.id'), nullable=True) # Pode ser ligado a sessão ou disciplina (vamos ligar a session por enquanto ou subject?)
    # Melhor ligar ao subject para persistir entre sessões
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False) # Texto extraído do PDF
    file_type = db.Column(db.String(50), default='pdf') # pdf, text, etc
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relacionamento
    subject = db.relationship('Subject', backref=db.backref('context_files', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'subject_id': self.subject_id,
            'filename': self.filename,
            'content_snippet': self.content[:100] + '...' if self.content else '',
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
