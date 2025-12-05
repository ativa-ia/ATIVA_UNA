"""
Modelos para o sistema de Quiz ao Vivo
"""
from app import db
from datetime import datetime, timedelta


class Quiz(db.Model):
    """Quiz ao vivo criado pelo professor"""
    __tablename__ = 'quizzes'
    
    id = db.Column(db.Integer, primary_key=True)
    subject_id = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    time_limit = db.Column(db.Integer, default=300)  # Tempo em segundos (default 5 min)
    
    # Status: waiting, active, ended
    status = db.Column(db.String(20), default='waiting')
    starts_at = db.Column(db.DateTime)
    ends_at = db.Column(db.DateTime)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    questions = db.relationship('QuizQuestion', backref='quiz', lazy=True, cascade='all, delete-orphan')
    responses = db.relationship('QuizResponse', backref='quiz', lazy=True, cascade='all, delete-orphan')
    subject = db.relationship('Subject', backref='quizzes', lazy=True)
    creator = db.relationship('User', backref='created_quizzes', lazy=True)
    
    def broadcast(self):
        """Inicia o quiz para todos os alunos"""
        self.status = 'active'
        self.starts_at = datetime.utcnow()
        self.ends_at = self.starts_at + timedelta(seconds=self.time_limit)
        db.session.commit()
    
    def end_quiz(self):
        """Encerra o quiz"""
        self.status = 'ended'
        db.session.commit()
    
    @property
    def is_active(self):
        """Verifica se o quiz está ativo"""
        if self.status != 'active':
            return False
        if self.ends_at and datetime.utcnow() > self.ends_at:
            self.end_quiz()
            return False
        return True
    
    @property
    def time_remaining(self):
        """Retorna tempo restante em segundos"""
        if not self.ends_at:
            return self.time_limit
        remaining = (self.ends_at - datetime.utcnow()).total_seconds()
        return max(0, int(remaining))
    
    def to_dict(self, include_questions=False):
        data = {
            'id': self.id,
            'subject_id': self.subject_id,
            'created_by': self.created_by,
            'title': self.title,
            'description': self.description,
            'time_limit': self.time_limit,
            'status': self.status,
            'starts_at': self.starts_at.isoformat() if self.starts_at else None,
            'ends_at': self.ends_at.isoformat() if self.ends_at else None,
            'time_remaining': self.time_remaining if self.status == 'active' else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'question_count': len(self.questions)
        }
        if include_questions:
            data['questions'] = [q.to_dict() for q in self.questions]
        return data


class QuizQuestion(db.Model):
    """Pergunta do quiz"""
    __tablename__ = 'quiz_questions'
    
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    question = db.Column(db.Text, nullable=False)
    options = db.Column(db.JSON, nullable=False)  # ["Opção A", "Opção B", "Opção C", "Opção D"]
    correct = db.Column(db.Integer, nullable=False)  # Índice da resposta correta (0-3)
    order = db.Column(db.Integer, default=0)  # Ordem da pergunta
    
    def to_dict(self, show_correct=False):
        data = {
            'id': self.id,
            'quiz_id': self.quiz_id,
            'question': self.question,
            'options': self.options,
            'order': self.order
        }
        if show_correct:
            data['correct'] = self.correct
        return data


class QuizResponse(db.Model):
    """Resposta do aluno ao quiz"""
    __tablename__ = 'quiz_responses'
    
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    answers = db.Column(db.JSON, nullable=False)  # {question_id: answer_index, ...}
    score = db.Column(db.Integer, default=0)  # Pontuação (número de acertos)
    total = db.Column(db.Integer, default=0)  # Total de perguntas
    percentage = db.Column(db.Float, default=0.0)  # Porcentagem de acerto
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    student = db.relationship('User', backref='quiz_responses', lazy=True)
    
    def calculate_score(self):
        """Calcula a pontuação baseada nas respostas"""
        quiz = Quiz.query.get(self.quiz_id)
        if not quiz:
            return
        
        correct_count = 0
        total_questions = len(quiz.questions)
        
        for question in quiz.questions:
            student_answer = self.answers.get(str(question.id))
            if student_answer is not None and student_answer == question.correct:
                correct_count += 1
        
        self.score = correct_count
        self.total = total_questions
        self.percentage = (correct_count / total_questions * 100) if total_questions > 0 else 0
        db.session.commit()
    
    def to_dict(self):
        return {
            'id': self.id,
            'quiz_id': self.quiz_id,
            'student_id': self.student_id,
            'student_name': self.student.name if self.student else None,
            'answers': self.answers,
            'score': self.score,
            'total': self.total,
            'percentage': self.percentage,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None
        }
