from app import db
from datetime import datetime


class Class(db.Model):
    """Modelo de Turma"""
    __tablename__ = 'classes'
    
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    semester = db.Column(db.String(20), nullable=False)  # Ex: "2024.1"
    year = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    enrollments = db.relationship('Enrollment', backref='class_ref', lazy=True, cascade='all, delete-orphan')
    teachings = db.relationship('Teaching', backref='class_ref', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Class {self.name}>'
    
    def to_dict(self):
        """Converter para dicionário"""
        return {
            'id': self.id,
            'course_id': self.course_id,
            'name': self.name,
            'semester': self.semester,
            'year': self.year,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
