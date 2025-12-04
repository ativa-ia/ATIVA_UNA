from app import db
from datetime import datetime


class Teaching(db.Model):
    """Modelo de Ensino (Professor -> Disciplina em uma Turma)"""
    __tablename__ = 'teachings'
    
    id = db.Column(db.Integer, primary_key=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    schedule = db.Column(db.String(100))  # Ex: "Terças e Quintas, 10:00 - 12:00"
    location = db.Column(db.String(100))  # Ex: "Sala B-204"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    teacher = db.relationship('User', backref='teachings', lazy=True)
    
    def __repr__(self):
        return f'<Teaching teacher={self.teacher_id} subject={self.subject_id}>'
    
    def to_dict(self):
        """Converter para dicionário"""
        return {
            'id': self.id,
            'teacher_id': self.teacher_id,
            'class_id': self.class_id,
            'subject_id': self.subject_id,
            'schedule': self.schedule,
            'location': self.location,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
