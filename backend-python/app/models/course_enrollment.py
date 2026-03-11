"""
Modelo de Matrícula Institucional (Aluno <-> Curso)
Um mesmo User pode ter múltiplas matrículas em cursos diferentes.
"""
from app import db
from datetime import datetime


class CourseEnrollment(db.Model):
    """Vínculo do aluno com um curso específico na instituição"""
    __tablename__ = 'course_enrollments'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    registration_number = db.Column(db.String(50), unique=True, nullable=True)
    status = db.Column(db.String(20), default='active')  # active, locked, graduated
    enrolled_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref=db.backref('course_enrollments', lazy=True))
    course = db.relationship('Course', backref=db.backref('course_enrollments', lazy=True))

    def __repr__(self):
        return f'<CourseEnrollment user={self.user_id} course={self.course_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'course_id': self.course_id,
            'course_name': self.course.name if self.course else None,
            'registration_number': self.registration_number,
            'status': self.status,
            'enrolled_at': self.enrolled_at.isoformat() if self.enrolled_at else None,
        }
