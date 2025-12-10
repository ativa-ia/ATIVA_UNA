from app import db
from datetime import datetime


class Grade(db.Model):
    """Modelo de Notas (AV1, AV2)"""
    __tablename__ = 'grades'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    assessment_type = db.Column(db.String(10), nullable=False)  # 'av1' ou 'av2'
    grade = db.Column(db.Float, nullable=False)  # Nota de 0-10
    date = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    student = db.relationship('User', foreign_keys=[student_id], backref='grades_received')
    teacher = db.relationship('User', foreign_keys=[created_by], backref='grades_created')
    subject = db.relationship('Subject', backref='grades')
    
    def __repr__(self):
        return f'<Grade student={self.student_id} subject={self.subject_id} {self.assessment_type}={self.grade}>'
    
    def to_dict(self):
        """Converter para dicionário"""
        return {
            'id': self.id,
            'student_id': self.student_id,
            'subject_id': self.subject_id,
            'assessment_type': self.assessment_type,
            'grade': self.grade,
            'date': self.date.isoformat() if self.date else None,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
