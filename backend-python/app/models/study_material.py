from app import db
from datetime import datetime

class StudyMaterial(db.Model):
    __tablename__ = 'study_materials'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    class_subject_id = db.Column(db.Integer, db.ForeignKey('class_subjects.id'), nullable=False)
    activity_id = db.Column(db.Integer, db.ForeignKey('live_activities.id'), nullable=True)
    
    title = db.Column(db.String(255), nullable=False)
    type = db.Column(db.String(50), nullable=False) # 'pdf', 'video', 'link'
    content_url = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.String(50), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'class_subject_id': self.class_subject_id,
            'activity_id': self.activity_id,
            'title': self.title,
            'type': self.type,
            'content_url': self.content_url,
            'file_size': self.file_size,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
