"""
Modelos para o sistema de Transcrição ao Vivo com Atividades
"""
from app import db
from datetime import datetime, timedelta


class TranscriptionSession(db.Model):
    """Sessão de transcrição de aula do professor"""
    __tablename__ = 'transcription_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), default='Transcrição de Aula')
    full_transcript = db.Column(db.Text, default='')  # Transcrição completa
    
    # Status: active, paused, ended
    status = db.Column(db.String(20), default='active')
    
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    subject = db.relationship('Subject', backref=db.backref('transcription_sessions', lazy=True))
    teacher = db.relationship('User', backref=db.backref('transcription_sessions', lazy=True))
    checkpoints = db.relationship('TranscriptionCheckpoint', backref='session', lazy=True, cascade='all, delete-orphan')
    activities = db.relationship('LiveActivity', backref='session', lazy=True, cascade='all, delete-orphan')
    
    def pause(self):
        """Pausa a sessão e cria um checkpoint"""
        self.status = 'paused'
        db.session.commit()
    
    def resume(self):
        """Retoma a sessão"""
        self.status = 'active'
        db.session.commit()
    
    def end(self):
        """Encerra a sessão"""
        self.status = 'ended'
        self.ended_at = datetime.utcnow()
        db.session.commit()
    
    @property
    def word_count(self):
        """Conta palavras na transcrição"""
        if not self.full_transcript:
            return 0
        return len(self.full_transcript.split())
    
    def to_dict(self, include_checkpoints=False, include_activities=False):
        data = {
            'id': self.id,
            'subject_id': self.subject_id,
            'teacher_id': self.teacher_id,
            'title': self.title,
            'full_transcript': self.full_transcript,
            'word_count': self.word_count,
            'status': self.status,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_checkpoints:
            data['checkpoints'] = [cp.to_dict() for cp in self.checkpoints]
        if include_activities:
            data['activities'] = [act.to_dict() for act in self.activities]
        return data


class TranscriptionCheckpoint(db.Model):
    """Checkpoint/pausa na transcrição - snapshot do texto naquele momento"""
    __tablename__ = 'transcription_checkpoints'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('transcription_sessions.id'), nullable=False)
    transcript_at_checkpoint = db.Column(db.Text, nullable=False)  # Snapshot da transcrição
    word_count = db.Column(db.Integer, default=0)
    reason = db.Column(db.String(100), nullable=True)  # quiz, summary, open_question
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'transcript_at_checkpoint': self.transcript_at_checkpoint,
            'word_count': self.word_count,
            'reason': self.reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class LiveActivity(db.Model):
    """Atividade interativa durante a aula (quiz, resumo, pergunta aberta)"""
    __tablename__ = 'live_activities'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('transcription_sessions.id'), nullable=False)
    checkpoint_id = db.Column(db.Integer, db.ForeignKey('transcription_checkpoints.id'), nullable=True)
    
    # Tipo: quiz, summary, open_question
    activity_type = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    
    # Conteúdo da atividade (JSON)
    # Quiz: {"questions": [{"question": "...", "options": [...], "correct": 0}, ...]}
    # Summary: {"summary_text": "..."}
    # Open Question: {"question": "Qual sua maior dúvida?"}
    content = db.Column(db.JSON, nullable=True)
    
    # Conteúdo gerado pela IA
    ai_generated_content = db.Column(db.Text, nullable=True)
    
    # Se foi compartilhado com os alunos
    shared_with_students = db.Column(db.Boolean, default=False)
    
    # Status: waiting, active, ended
    status = db.Column(db.String(20), default='waiting')
    
    time_limit = db.Column(db.Integer, default=300)  # Tempo em segundos
    starts_at = db.Column(db.DateTime, nullable=True)
    ends_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    checkpoint = db.relationship('TranscriptionCheckpoint', backref='activities')
    responses = db.relationship('LiveActivityResponse', backref='activity', lazy=True, cascade='all, delete-orphan')
    
    def broadcast(self):
        """Inicia a atividade para os alunos"""
        self.status = 'active'
        self.shared_with_students = True
        self.starts_at = datetime.utcnow()
        if self.time_limit:
            self.ends_at = self.starts_at + timedelta(seconds=self.time_limit)
        db.session.commit()
    
    def end_activity(self):
        """Encerra a atividade"""
        self.status = 'ended'
        self.ends_at = datetime.utcnow()
        db.session.commit()
    
    @property
    def is_active(self):
        """Verifica se a atividade está ativa"""
        if self.status != 'active':
            return False
        if self.ends_at and datetime.utcnow() > self.ends_at:
            self.end_activity()
            return False
        return True
    
    @property
    def time_remaining(self):
        """Retorna tempo restante em segundos"""
        if not self.ends_at:
            return self.time_limit
        remaining = (self.ends_at - datetime.utcnow()).total_seconds()
        return max(0, int(remaining))
    
    def to_dict(self, include_responses=False):
        data = {
            'id': self.id,
            'session_id': self.session_id,
            'checkpoint_id': self.checkpoint_id,
            'activity_type': self.activity_type,
            'title': self.title,
            'content': self.content,
            'ai_generated_content': self.ai_generated_content,
            'shared_with_students': self.shared_with_students,
            'status': self.status,
            'time_limit': self.time_limit,
            'time_remaining': self.time_remaining if self.status == 'active' else None,
            'starts_at': self.starts_at.isoformat() if self.starts_at else None,
            'ends_at': self.ends_at.isoformat() if self.ends_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'response_count': len(self.responses) if self.responses else 0,
        }
        if include_responses:
            data['responses'] = [r.to_dict() for r in self.responses]
        return data


class LiveActivityResponse(db.Model):
    """Resposta do aluno a uma atividade"""
    __tablename__ = 'live_activity_responses'
    
    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(db.Integer, db.ForeignKey('live_activities.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Dados da resposta (JSON)
    # Quiz: {"answers": {question_id: answer_index, ...}}
    # Open Question: {"text": "resposta do aluno"}
    response_data = db.Column(db.JSON, nullable=False)
    
    # Para quiz: resultado
    is_correct = db.Column(db.Boolean, nullable=True)
    score = db.Column(db.Integer, default=0)
    total = db.Column(db.Integer, default=0)
    percentage = db.Column(db.Float, default=0.0)
    
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    student = db.relationship('User', backref='live_activity_responses', lazy=True)
    
    def calculate_quiz_score(self):
        """Calcula pontuação básica para quiz"""
        activity = LiveActivity.query.get(self.activity_id)
        if not activity or activity.activity_type != 'quiz':
            return
        
        questions = activity.content.get('questions', [])
        answers = self.response_data.get('answers', {})
        
        correct_count = 0
        total_questions = len(questions)
        
        for i, question in enumerate(questions):
            student_answer = answers.get(str(i))
            if student_answer is not None and student_answer == question.get('correct'):
                correct_count += 1
        
        self.score = correct_count
        self.total = total_questions
        self.percentage = (correct_count / total_questions * 100) if total_questions > 0 else 0
        self.is_correct = correct_count == total_questions
        
        db.session.commit()
    
    def to_dict(self):
        return {
            'id': self.id,
            'activity_id': self.activity_id,
            'student_id': self.student_id,
            'student_name': self.student.name if self.student else None,
            'response_data': self.response_data,
            'is_correct': self.is_correct,
            'score': self.score,
            'total': self.total,
            'percentage': self.percentage,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
        }
