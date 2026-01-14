from app import db
from datetime import datetime
import secrets
import string

class PresentationSession(db.Model):
    __tablename__ = 'presentation_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(6), unique=True, nullable=False, index=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), default='active')  # active/ended
    current_content = db.Column(db.JSON, nullable=True)  # Conteúdo atual exibido
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    teacher = db.relationship('User', backref='presentations')
    
    @staticmethod
    def generate_code(length=6):
        """Gera código único alfanumérico (ex: ABC123)"""
        chars = string.ascii_uppercase + string.digits
        while True:
            code = ''.join(secrets.choice(chars) for _ in range(length))
            if not PresentationSession.query.filter_by(code=code).first():
                return code
    
    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'teacher_id': self.teacher_id,
            'status': self.status,
            'current_content': self.current_content,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
    
    def end_session(self):
        """Encerra a sessão (marca como ended)"""
        self.status = 'ended'
        db.session.commit()
