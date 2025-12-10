from app import db
from datetime import datetime


class ActivitySubmission(db.Model):
    """Modelo de Submissão de Atividades"""
    __tablename__ = 'activity_submissions'
    
    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(db.Integer, db.ForeignKey('activities.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # 'pending', 'submitted', 'graded'
    grade = db.Column(db.Float, nullable=True)  # Nota da atividade (0-10)
    submitted_at = db.Column(db.DateTime, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    activity = db.relationship('Activity', backref='submissions')
    student = db.relationship('User', backref='activity_submissions')
    
    def __repr__(self):
        return f'<ActivitySubmission activity={self.activity_id} student={self.student_id} status={self.status}>'
    
    def to_dict(self):
        """Converter para dicionário"""
        return {
            'id': self.id,
            'activity_id': self.activity_id,
            'student_id': self.student_id,
            'status': self.status,
            'grade': self.grade,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'graded_at': self.graded_at.isoformat() if self.graded_at else None,
            'feedback': self.feedback,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
