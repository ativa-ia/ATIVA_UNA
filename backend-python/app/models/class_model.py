from app import db
from datetime import datetime


class Class(db.Model):
    """Modelo de Turma"""
    __tablename__ = 'classes'
    
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(30), unique=True, nullable=True, index=True)  # Ex: "CC-2024.1"
    semester = db.Column(db.String(20), nullable=False)  # Ex: "2024.1"
    year = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships (class_subjects vem via backref no ClassSubject)
    
    def __repr__(self):
        return f'<Class {self.name}>'
    
    def to_dict(self):
        """Converter para dicionário"""
        return {
            'id': self.id,
            'course_id': self.course_id,
            'name': self.name,
            'code': self.code,
            'semester': self.semester,
            'year': self.year,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
