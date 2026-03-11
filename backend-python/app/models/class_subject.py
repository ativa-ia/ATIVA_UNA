"""
Modelo de Oferta de Disciplina na Turma (ClassSubject)
Representa uma disciplina do catálogo sendo ofertada para uma turma específica.
É a tabela central que substitui o vínculo direto com Subject nas tabelas filhas.
"""
from app import db
from datetime import datetime


class ClassSubject(db.Model):
    """Oferta de uma disciplina do catálogo em uma turma específica"""
    __tablename__ = 'class_subjects'

    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    status = db.Column(db.String(20), default='active')  # active, finished
    semester_offered = db.Column(db.String(20), nullable=True)  # Ex: "2024.1"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Unique constraint: mesma disciplina não pode ser ofertada 2x na mesma turma
    __table_args__ = (
        db.UniqueConstraint('class_id', 'subject_id', name='uq_class_subject'),
    )

    # Relationships
    class_ref = db.relationship('Class', backref=db.backref('class_subjects', lazy=True))
    subject = db.relationship('Subject', backref=db.backref('class_subjects', lazy=True))

    # Filhas diretas (todas as tabelas que antes apontavam pra subject_id)
    teachings = db.relationship('Teaching', backref='class_subject', lazy=True, cascade='all, delete-orphan')
    enrollments = db.relationship('Enrollment', backref='class_subject', lazy=True, cascade='all, delete-orphan')
    materials = db.relationship('Material', backref='class_subject', lazy=True, cascade='all, delete-orphan')
    activities = db.relationship('Activity', backref='class_subject', lazy=True, cascade='all, delete-orphan')
    lesson_recaps = db.relationship('LessonRecap', backref='class_subject', lazy=True)
    transcription_sessions = db.relationship('TranscriptionSession', backref='class_subject', lazy=True)
    socratic_sessions = db.relationship('SocraticSession', backref='class_subject', lazy=True)
    ai_sessions = db.relationship('AISession', backref='class_subject', lazy=True)
    chat_messages = db.relationship('ChatMessage', backref='class_subject', lazy=True)
    study_materials = db.relationship('StudyMaterial', backref='class_subject', lazy=True)

    def __repr__(self):
        return f'<ClassSubject class={self.class_id} subject={self.subject_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'class_id': self.class_id,
            'class_name': self.class_ref.name if self.class_ref else None,
            'subject_id': self.subject_id,
            'subject_name': self.subject.name if self.subject else None,
            'subject_code': self.subject.code if self.subject else None,
            'status': self.status,
            'semester_offered': self.semester_offered,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
