from app import db
from datetime import datetime


class Activity(db.Model):
    """Modelo de Atividade/Quiz"""
    __tablename__ = 'activities'
    
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    type = db.Column(db.String(20), nullable=False)  # 'assignment', 'quiz'
    due_date = db.Column(db.String(50))  # Ex: "em 3 dias" ou data específica
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    creator = db.relationship('User', backref='activities', lazy=True)
    
    def __repr__(self):
        return f'<Activity {self.title}>'
    
    def to_dict(self):
        """Converter para dicionário"""
        return {
            'id': self.id,
            'subject_id': self.subject_id,
            'title': self.title,
            'description': self.description,
            'type': self.type,
            'due_date': self.due_date,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
