from app import db
from datetime import datetime

class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50), default='general')  # 'quiz', 'summary', 'open_question', 'material', 'general'
    
    # Relacionamentos
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    sent_to_students = db.Column(db.Boolean, default=False)

    def to_dict(self):
        # Buscar nomes dinamicamente para evitar relationships que podem conflitar
        subject_name = None
        teacher_name = None
        try:
            from app.models.subject import Subject
            from app.models.user import User
            subject = Subject.query.get(self.subject_id)
            teacher = User.query.get(self.teacher_id)
            subject_name = subject.name if subject else None
            teacher_name = teacher.name if teacher else None
        except:
            pass

        return {
            'id': self.id,
            'title': self.title,
            'message': self.message,
            'type': self.type,
            'subject_id': self.subject_id,
            'teacher_id': self.teacher_id,
            'subject_name': subject_name,
            'teacher_name': teacher_name,
            'created_at': self.created_at.isoformat(),
            'sent_to_students': self.sent_to_students
        }

