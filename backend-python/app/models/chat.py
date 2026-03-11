"""
Modelo para Chat de IA
"""
from app import db
from datetime import datetime


class ChatMessage(db.Model):
    """Mensagem de chat entre professor e IA"""
    __tablename__ = 'chat_messages'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    class_subject_id = db.Column(db.Integer, db.ForeignKey('class_subjects.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_user = db.Column(db.Boolean, default=True)  # True = mensagem do usuário, False = resposta da IA
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    user = db.relationship('User', backref=db.backref('chat_messages', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'class_subject_id': self.class_subject_id,
            'content': self.content,
            'is_user': self.is_user,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def get_history(cls, user_id, class_subject_id, limit=50):
        """Busca histórico de chat de um usuário para uma oferta de disciplina"""
        return cls.query.filter_by(
            user_id=user_id,
            class_subject_id=class_subject_id
        ).order_by(cls.created_at.asc()).limit(limit).all()
    
    @classmethod
    def clear_history(cls, user_id, class_subject_id):
        """Limpa histórico de chat de um usuário para uma oferta de disciplina"""
        cls.query.filter_by(
            user_id=user_id,
            class_subject_id=class_subject_id
        ).delete()
        db.session.commit()
