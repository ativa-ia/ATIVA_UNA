from app import db
from datetime import datetime


class Enrollment(db.Model):
    """Modelo de Matrícula (Aluno -> Disciplina)"""
    __tablename__ = 'enrollments'
    
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    enrolled_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    student = db.relationship('User', backref='enrollments', lazy=True)
    
    def __repr__(self):
        return f'<Enrollment student={self.student_id} subject={self.subject_id}>'
    
    def to_dict(self):
        """Converter para dicionário"""
        return {
            'id': self.id,
            'student_id': self.student_id,
            'class_id': self.class_id,
            'subject_id': self.subject_id,
            'enrolled_at': self.enrolled_at.isoformat() if self.enrolled_at else None
        }
