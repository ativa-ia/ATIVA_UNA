"""
Modelo para o Assistente Socrático
Sessões de conversa com histórico completo armazenado em JSON
"""
from app import db
from datetime import datetime


class SocraticSession(db.Model):
    """Sessão de conversa socrática - todo o histórico fica em uma coluna JSON"""
    __tablename__ = 'socratic_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)

    title = db.Column(db.String(200), default='Conversa Socrática')
    status = db.Column(db.String(20), default='active')  # active, finished

    # Array JSON com todas as mensagens da sessão
    # Formato: [{"role": "user"|"assistant", "content": "...", "timestamp": "ISO..."}]
    messages_data = db.Column(db.JSON, default=list)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relacionamentos
    user = db.relationship('User', backref=db.backref('socratic_sessions', lazy=True))
    subject = db.relationship('Subject', backref=db.backref('socratic_sessions', lazy=True))

    def add_message(self, role, content):
        """Adiciona uma mensagem ao histórico JSON da sessão"""
        if self.messages_data is None:
            self.messages_data = []
        msg = {
            'role': role,
            'content': content,
            'timestamp': datetime.utcnow().isoformat()
        }
        # SQLAlchemy não detecta mutação em JSON, precisamos forçar
        updated = list(self.messages_data)
        updated.append(msg)
        self.messages_data = updated
        return msg

    def finish(self):
        """Encerra a sessão"""
        self.status = 'finished'
        db.session.commit()

    def to_dict(self, include_messages=True):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'subject_id': self.subject_id,
            'title': self.title,
            'status': self.status,
            'message_count': len(self.messages_data) if self.messages_data else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_messages:
            data['messages_data'] = self.messages_data if self.messages_data else []
        return data
