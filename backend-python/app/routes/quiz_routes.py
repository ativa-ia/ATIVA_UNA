"""
Rotas da API de Quiz ao Vivo
"""
from flask import Blueprint, request, jsonify
from app.middleware.auth_middleware import token_required
from app.models.quiz import Quiz, QuizQuestion, QuizResponse
from app.models.enrollment import Enrollment
from app import db
from datetime import datetime

quiz_bp = Blueprint('quiz', __name__)


@quiz_bp.route('/create', methods=['POST'])
@token_required
def create_quiz(current_user):
    """
    Cria um quiz a partir do conteúdo processado pela IA
    
    Body:
    {
        "subject_id": int,
        "title": str,
        "description": str (optional),
        "time_limit": int (seconds, default 300),
        "questions": [
            {"question": "...", "options": ["A", "B", "C", "D"], "correct": 0}
        ]
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
    
    subject_id = data.get('subject_id')
    title = data.get('title', 'Quiz')
    description = data.get('description', '')
    time_limit = data.get('time_limit', 300)
    questions_data = data.get('questions', [])
    
    if not subject_id:
        return jsonify({'success': False, 'error': 'ID da disciplina não fornecido'}), 400
    
    if not questions_data:
        return jsonify({'success': False, 'error': 'Nenhuma pergunta fornecida'}), 400
    
    # Criar quiz
    quiz = Quiz(
        subject_id=subject_id,
        created_by=current_user.id,
        title=title,
        description=description,
        time_limit=time_limit,
        status='waiting'
    )
    db.session.add(quiz)
    db.session.flush()  # Para obter o ID
    
    # Adicionar perguntas
    for i, q in enumerate(questions_data):
        question = QuizQuestion(
            quiz_id=quiz.id,
            question=q.get('question', ''),
            options=q.get('options', []),
            correct=q.get('correct', 0),
            order=i
        )
        db.session.add(question)
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'quiz': quiz.to_dict(include_questions=True)
    })


@quiz_bp.route('/<int:quiz_id>/broadcast', methods=['POST'])
@token_required
def broadcast_quiz(current_user, quiz_id):
    """
    Professor envia o quiz para todos os alunos (inicia o timer)
    """
    quiz = Quiz.query.get(quiz_id)
    
    if not quiz:
        return jsonify({'success': False, 'error': 'Quiz não encontrado'}), 404
    
    if quiz.created_by != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    if quiz.status != 'waiting':
        return jsonify({'success': False, 'error': 'Quiz já foi enviado ou encerrado'}), 400
    
    # Broadcast - inicia o timer
    quiz.broadcast()
    
    # Contar alunos matriculados
    enrolled_count = Enrollment.query.filter_by(subject_id=quiz.subject_id).count()
    
    return jsonify({
        'success': True,
        'message': f'Quiz enviado para {enrolled_count} alunos!',
        'quiz': quiz.to_dict(),
        'enrolled_students': enrolled_count
    })


@quiz_bp.route('/active/<int:subject_id>', methods=['GET'])
@token_required
def get_active_quiz(current_user, subject_id):
    """
    Aluno verifica se há quiz ativo na disciplina (polling)
    """
    # Verificar se o aluno está matriculado
    enrollment = Enrollment.query.filter_by(
        student_id=current_user.id,
        subject_id=subject_id
    ).first()
    
    if not enrollment and current_user.role != 'teacher':
        return jsonify({'success': False, 'error': 'Não matriculado'}), 403
    
    # Buscar quiz ativo
    quiz = Quiz.query.filter_by(
        subject_id=subject_id,
        status='active'
    ).first()
    
    if not quiz:
        return jsonify({
            'success': True,
            'active': False,
            'quiz': None
        })
    
    # Verificar se o tempo acabou
    if not quiz.is_active:
        return jsonify({
            'success': True,
            'active': False,
            'quiz': None
        })
    
    # Verificar se o aluno já respondeu
    existing_response = QuizResponse.query.filter_by(
        quiz_id=quiz.id,
        student_id=current_user.id
    ).first()
    
    return jsonify({
        'success': True,
        'active': True,
        'already_answered': existing_response is not None,
        'quiz': quiz.to_dict(include_questions=True)
    })


@quiz_bp.route('/<int:quiz_id>/submit', methods=['POST'])
@token_required
def submit_response(current_user, quiz_id):
    """
    Aluno envia suas respostas
    
    Body:
    {
        "answers": {
            "question_id": answer_index,
            ...
        }
    }
    """
    quiz = Quiz.query.get(quiz_id)
    
    if not quiz:
        return jsonify({'success': False, 'error': 'Quiz não encontrado'}), 404
    
    # Verificar se ainda está ativo
    if not quiz.is_active:
        return jsonify({'success': False, 'error': 'Quiz encerrado'}), 400
    
    # Verificar se já respondeu
    existing = QuizResponse.query.filter_by(
        quiz_id=quiz_id,
        student_id=current_user.id
    ).first()
    
    if existing:
        return jsonify({'success': False, 'error': 'Você já respondeu este quiz'}), 400
    
    data = request.get_json()
    answers = data.get('answers', {})
    
    # Criar resposta
    response = QuizResponse(
        quiz_id=quiz_id,
        student_id=current_user.id,
        answers=answers
    )
    db.session.add(response)
    db.session.commit()
    
    # Calcular pontuação
    response.calculate_score()
    
    return jsonify({
        'success': True,
        'message': 'Resposta enviada!',
        'result': response.to_dict()
    })


@quiz_bp.route('/<int:quiz_id>/report', methods=['GET'])
@token_required
def get_report(current_user, quiz_id):
    """
    Professor obtém relatório do quiz
    """
    quiz = Quiz.query.get(quiz_id)
    
    if not quiz:
        return jsonify({'success': False, 'error': 'Quiz não encontrado'}), 404
    
    if quiz.created_by != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    # Buscar todas as respostas
    responses = QuizResponse.query.filter_by(quiz_id=quiz_id)\
        .order_by(QuizResponse.percentage.desc())\
        .all()
    
    # Contar matriculados
    enrolled_count = Enrollment.query.filter_by(subject_id=quiz.subject_id).count()
    
    # Calcular estatísticas
    total_responses = len(responses)
    avg_score = sum(r.percentage for r in responses) / total_responses if total_responses > 0 else 0
    
    # Top 3
    top_students = [r.to_dict() for r in responses[:3]]
    
    # Pergunta mais errada
    question_stats = {}
    for question in quiz.questions:
        correct_count = 0
        for response in responses:
            if response.answers.get(str(question.id)) == question.correct:
                correct_count += 1
        question_stats[question.id] = {
            'question': question.question,
            'correct_rate': (correct_count / total_responses * 100) if total_responses > 0 else 0
        }
    
    # Encontrar a pergunta com menor taxa de acerto
    worst_question = None
    lowest_rate = 100
    for q_id, stats in question_stats.items():
        if stats['correct_rate'] < lowest_rate:
            lowest_rate = stats['correct_rate']
            worst_question = stats
    
    return jsonify({
        'success': True,
        'report': {
            'quiz': quiz.to_dict(),
            'enrolled_count': enrolled_count,
            'response_count': total_responses,
            'response_rate': (total_responses / enrolled_count * 100) if enrolled_count > 0 else 0,
            'average_score': round(avg_score, 1),
            'top_students': top_students,
            'worst_question': worst_question,
            'all_responses': [r.to_dict() for r in responses]
        }
    })


@quiz_bp.route('/<int:quiz_id>/end', methods=['POST'])
@token_required
def end_quiz_manually(current_user, quiz_id):
    """Professor encerra o quiz manualmente"""
    quiz = Quiz.query.get(quiz_id)
    
    if not quiz:
        return jsonify({'success': False, 'error': 'Quiz não encontrado'}), 404
    
    if quiz.created_by != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    quiz.end_quiz()
    
    return jsonify({
        'success': True,
        'message': 'Quiz encerrado'
    })


@quiz_bp.route('/subject/<int:subject_id>', methods=['GET'])
@token_required
def list_quizzes(current_user, subject_id):
    """Lista todos os quizzes de uma disciplina"""
    quizzes = Quiz.query.filter_by(subject_id=subject_id)\
        .order_by(Quiz.created_at.desc())\
        .all()
    
    return jsonify({
        'success': True,
        'quizzes': [q.to_dict() for q in quizzes]
    })
