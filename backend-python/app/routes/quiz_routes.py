"""
Rotas da API de Quiz ao Vivo
"""
from flask import Blueprint, request, jsonify
from app.middleware.auth_middleware import token_required
from app.models.quiz import Quiz, QuizQuestion, QuizResponse
from app.models.enrollment import Enrollment
from app import db
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

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
        },
        "time_taken": int (seconds)
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
    time_taken = data.get('time_taken', 0)  # Tempo em segundos
    
    # Criar resposta
    response = QuizResponse(
        quiz_id=quiz_id,
        student_id=current_user.id,
        answers=answers,
        time_taken=time_taken
    )
    db.session.add(response)
    db.session.commit()
    
    # Calcular pontuação
    response.calculate_score()
    
    # Emitir evento WebSocket para atualizar ranking em tempo real
    try:
        from app.services.websocket_service import emit_new_response, emit_ranking_update
        
        # Emitir nova resposta
        emit_new_response(quiz_id, {
            'student_id': current_user.id,
            'student_name': current_user.name,
            'points': response.points,
            'percentage': response.percentage
        })
        
        # Buscar ranking atualizado e emitir
        responses = QuizResponse.query.filter_by(quiz_id=quiz_id)\
            .order_by(QuizResponse.points.desc(), QuizResponse.submitted_at.asc())\
            .all()
        
        enrolled_count = Enrollment.query.filter_by(subject_id=quiz.subject_id).count()
        
        ranking = []
        for i, r in enumerate(responses):
            ranking.append({
                'position': i + 1,
                'student_id': r.student_id,
                'student_name': r.student.name if r.student else 'Desconhecido',
                'points': r.points,
                'score': r.score,
                'total': r.total,
                'percentage': r.percentage,
                'time_taken': r.time_taken,
            })
        
        emit_ranking_update(quiz_id, {
            'quiz_id': quiz_id,
            'quiz_status': quiz.status,
            'enrolled_count': enrolled_count,
            'response_count': len(responses),
            'ranking': ranking
        })
        
    except Exception as e:
        logger.error(f"Erro ao emitir evento WebSocket: {e}")
    
    return jsonify({
        'success': True,
        'message': 'Resposta enviada!',
        'result': response.to_dict()
    })


@quiz_bp.route('/<int:quiz_id>/progress', methods=['POST'])
@token_required
def update_progress(current_user, quiz_id):
    """
    Aluno envia progresso parcial (respostas até agora)
    Permite atualização em tempo real do ranking
    """
    quiz = Quiz.query.get(quiz_id)
    
    if not quiz:
        return jsonify({'success': False, 'error': 'Quiz não encontrado'}), 404
    
    # Verificar se ainda está ativo
    if not quiz.is_active:
        return jsonify({'success': False, 'error': 'Quiz encerrado'}), 400
    
    data = request.get_json()
    answers = data.get('answers', {})
    time_taken = data.get('time_taken', 0)
    
    # Buscar ou criar resposta
    response = QuizResponse.query.filter_by(
        quiz_id=quiz_id,
        student_id=current_user.id
    ).first()
    
    if not response:
        response = QuizResponse(
            quiz_id=quiz_id,
            student_id=current_user.id,
            answers=answers,
            time_taken=time_taken
        )
        db.session.add(response)
    else:
        # Atualizar respostas existentes (merge)
        current_answers = response.answers or {}
        current_answers.update(answers)
        response.answers = current_answers
        response.time_taken = time_taken
    
    # Calcular pontuação parcial
    response.calculate_score()
    db.session.commit()
    
    # Emitir evento WebSocket (opcional, se já tiver implementado)
    try:
        from app.services.websocket_service import emit_new_response
        emit_new_response(quiz_id, {
            'student_id': current_user.id,
            'student_name': current_user.name,
            'points': response.points,
            'percentage': response.percentage
        })
    except Exception as e:
        # Silencioso se não tiver websocket
        pass
    
    return jsonify({
        'success': True,
        'points': response.points
    })


@quiz_bp.route('/<int:quiz_id>/report', methods=['GET'])
@token_required
def get_report(current_user, quiz_id):
    """
    Professor obtém relatório completo e detalhado do quiz
    Inclui análises avançadas, distribuições e estatísticas comparativas
    """
    quiz = Quiz.query.get(quiz_id)
    
    if not quiz:
        return jsonify({'success': False, 'error': 'Quiz não encontrado'}), 404
    
    if quiz.created_by != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    # Buscar todas as respostas ordenadas por pontuação
    responses = QuizResponse.query.filter_by(quiz_id=quiz_id)\
        .order_by(QuizResponse.points.desc(), QuizResponse.submitted_at.asc())\
        .all()
    
    # Contar matriculados
    enrolled_count = Enrollment.query.filter_by(subject_id=quiz.subject_id).count()
    
    # Calcular estatísticas básicas
    total_responses = len(responses)
    avg_score = sum(r.percentage for r in responses) / total_responses if total_responses > 0 else 0
    
    # Top 3 estudantes
    top_students = [r.to_dict() for r in responses[:3]]
    
    # ========== PERFORMANCE DISTRIBUTION ==========
    performance_distribution = {
        'excellent': 0,    # 90-100%
        'good': 0,         # 70-89%
        'average': 0,      # 50-69%
        'below_average': 0 # <50%
    }
    
    for response in responses:
        if response.percentage >= 90:
            performance_distribution['excellent'] += 1
        elif response.percentage >= 70:
            performance_distribution['good'] += 1
        elif response.percentage >= 50:
            performance_distribution['average'] += 1
        else:
            performance_distribution['below_average'] += 1
    
    # ========== QUESTION ANALYTICS ==========
    question_analytics = []
    for question in quiz.questions:
        correct_count = 0
        incorrect_count = 0
        wrong_answers = {}  # Conta respostas erradas
        
        for response in responses:
            student_answer = response.answers.get(str(question.id))
            if student_answer is not None:
                if student_answer == question.correct:
                    correct_count += 1
                else:
                    incorrect_count += 1
                    # Contar qual resposta errada foi mais escolhida
                    wrong_answers[student_answer] = wrong_answers.get(student_answer, 0) + 1
        
        total_answers = correct_count + incorrect_count
        correct_rate = (correct_count / total_answers * 100) if total_answers > 0 else 0
        
        # Determinar dificuldade baseada na taxa de acerto
        if correct_rate >= 70:
            difficulty = 'easy'
        elif correct_rate >= 40:
            difficulty = 'medium'
        else:
            difficulty = 'hard'
        
        # Resposta errada mais comum
        most_common_wrong = max(wrong_answers.items(), key=lambda x: x[1])[0] if wrong_answers else None
        
        question_analytics.append({
            'question_id': question.id,
            'question_text': question.question,
            'correct_count': correct_count,
            'incorrect_count': incorrect_count,
            'correct_rate': round(correct_rate, 1),
            'difficulty_level': difficulty,
            'most_common_wrong_answer': most_common_wrong
        })
    
    # Encontrar melhor e pior questão
    best_question = max(question_analytics, key=lambda x: x['correct_rate']) if question_analytics else None
    worst_question = min(question_analytics, key=lambda x: x['correct_rate']) if question_analytics else None
    
    # ========== TIME ANALYTICS ==========
    time_analytics = {
        'average_completion_time': 0,
        'fastest_completion': 0,
        'slowest_completion': 0,
        'median_time': 0
    }
    
    if responses:
        times = [r.time_taken for r in responses if r.time_taken > 0]
        if times:
            time_analytics['average_completion_time'] = round(sum(times) / len(times), 1)
            time_analytics['fastest_completion'] = min(times)
            time_analytics['slowest_completion'] = max(times)
            
            # Calcular mediana
            sorted_times = sorted(times)
            mid = len(sorted_times) // 2
            if len(sorted_times) % 2 == 0:
                time_analytics['median_time'] = (sorted_times[mid-1] + sorted_times[mid]) / 2
            else:
                time_analytics['median_time'] = sorted_times[mid]
    
    # ========== SCORE DISTRIBUTION ==========
    score_ranges = [
        {'min': 0, 'max': 20, 'count': 0},
        {'min': 20, 'max': 40, 'count': 0},
        {'min': 40, 'max': 60, 'count': 0},
        {'min': 60, 'max': 80, 'count': 0},
        {'min': 80, 'max': 100, 'count': 0}
    ]
    
    for response in responses:
        for range_item in score_ranges:
            if range_item['min'] <= response.percentage < range_item['max'] or \
               (range_item['max'] == 100 and response.percentage == 100):
                range_item['count'] += 1
                break
    
    # Adicionar porcentagens
    for range_item in score_ranges:
        range_item['percentage'] = round((range_item['count'] / total_responses * 100), 1) if total_responses > 0 else 0
    
    # ========== COMPARATIVE STATS ==========
    percentages = [r.percentage for r in responses]
    
    # Calcular mediana
    class_median = 0
    if percentages:
        sorted_percentages = sorted(percentages)
        mid = len(sorted_percentages) // 2
        if len(sorted_percentages) % 2 == 0:
            class_median = (sorted_percentages[mid-1] + sorted_percentages[mid]) / 2
        else:
            class_median = sorted_percentages[mid]
    
    # Calcular moda (valor mais frequente)
    from collections import Counter
    class_mode = 0
    if percentages:
        rounded_percentages = [round(p) for p in percentages]
        counter = Counter(rounded_percentages)
        class_mode = counter.most_common(1)[0][0] if counter else 0
    
    # Calcular desvio padrão
    import math
    standard_deviation = 0
    if len(percentages) > 1:
        mean = sum(percentages) / len(percentages)
        variance = sum((x - mean) ** 2 for x in percentages) / len(percentages)
        standard_deviation = math.sqrt(variance)
    
    comparative_stats = {
        'class_median': round(class_median, 1),
        'class_mode': class_mode,
        'standard_deviation': round(standard_deviation, 1),
        'participation_rate': round((total_responses / enrolled_count * 100), 1) if enrolled_count > 0 else 0
    }
    
    # ========== RETORNAR RELATÓRIO COMPLETO ==========
    return jsonify({
        'success': True,
        'report': {
            # Dados básicos
            'quiz': quiz.to_dict(),
            'enrolled_count': enrolled_count,
            'response_count': total_responses,
            'response_rate': round((total_responses / enrolled_count * 100), 1) if enrolled_count > 0 else 0,
            'average_score': round(avg_score, 1),
            'top_students': top_students,
            'all_responses': [r.to_dict() for r in responses],
            
            # Análises avançadas
            'performance_distribution': performance_distribution,
            'question_analytics': question_analytics,
            'time_analytics': time_analytics,
            'score_distribution': {'ranges': score_ranges},
            'comparative_stats': comparative_stats,
            
            # Destaques
            'best_question': {
                'question': best_question['question_text'],
                'correct_rate': best_question['correct_rate']
            } if best_question else None,
            'worst_question': {
                'question': worst_question['question_text'],
                'correct_rate': worst_question['correct_rate']
            } if worst_question else None
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


@quiz_bp.route('/<int:quiz_id>/live-ranking', methods=['GET'])
@token_required
def get_live_ranking(current_user, quiz_id):
    """
    Retorna ranking em tempo real do quiz (para WebSocket/polling)
    """
    quiz = Quiz.query.get(quiz_id)
    
    if not quiz:
        return jsonify({'success': False, 'error': 'Quiz não encontrado'}), 404
    
    if quiz.created_by != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    # Buscar todas as respostas ordenadas por pontos
    responses = QuizResponse.query.filter_by(quiz_id=quiz_id)\
        .order_by(QuizResponse.points.desc(), QuizResponse.submitted_at.asc())\
        .all()
    
    # Contar matriculados
    enrolled_count = Enrollment.query.filter_by(subject_id=quiz.subject_id).count()
    
    # Preparar ranking
    ranking = []
    for i, response in enumerate(responses):
        ranking.append({
            'position': i + 1,
            'student_id': response.student_id,
            'student_name': response.student.name if response.student else 'Desconhecido',
            'points': response.points,
            'score': response.score,
            'total': response.total,
            'percentage': response.percentage,
            'time_taken': response.time_taken,
            'submitted_at': response.submitted_at.isoformat() if response.submitted_at else None
        })
    
    return jsonify({
        'success': True,
        'quiz_id': quiz_id,
        'quiz_status': quiz.status,
        'enrolled_count': enrolled_count,
        'response_count': len(responses),
        'ranking': ranking
    })


@quiz_bp.route('/<int:quiz_id>/export-pdf', methods=['GET'])
@token_required
def export_quiz_pdf(current_user, quiz_id):
    """
    Gera e retorna PDF do relatório do quiz
    """
    from flask import send_file
    from app.services.pdf_service import generate_quiz_report_pdf
    import io
    
    quiz = Quiz.query.get(quiz_id)
    
    if not quiz:
        return jsonify({'success': False, 'error': 'Quiz não encontrado'}), 404
    
    if quiz.created_by != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    # Buscar ranking
    responses = QuizResponse.query.filter_by(quiz_id=quiz_id)\
        .order_by(QuizResponse.points.desc(), QuizResponse.submitted_at.asc())\
        .all()
    
    enrolled_count = Enrollment.query.filter_by(subject_id=quiz.subject_id).count()
    total_responses = len(responses)
    
    # Preparar dados do ranking
    ranking = []
    for i, response in enumerate(responses):
        ranking.append({
            'position': i + 1,
            'student_id': response.student_id,
            'student_name': response.student.name if response.student else 'Desconhecido',
            'points': response.points,
            'score': response.score,
            'total': response.total,
            'percentage': response.percentage,
            'time_taken': response.time_taken,
        })
    
    # ========== PERFORMANCE DISTRIBUTION ==========
    performance_distribution = {
        'excellent': 0,    # 90-100%
        'good': 0,         # 70-89%
        'average': 0,      # 50-69%
        'below_average': 0 # <50%
    }
    
    for response in responses:
        if response.percentage >= 90:
            performance_distribution['excellent'] += 1
        elif response.percentage >= 70:
            performance_distribution['good'] += 1
        elif response.percentage >= 50:
            performance_distribution['average'] += 1
        else:
            performance_distribution['below_average'] += 1
    
    # ========== QUESTION ANALYTICS ==========
    question_analytics = []
    for question in quiz.questions:
        correct_count = 0
        incorrect_count = 0
        
        for response in responses:
            student_answer = response.answers.get(str(question.id))
            if student_answer is not None:
                if student_answer == question.correct:
                    correct_count += 1
                else:
                    incorrect_count += 1
        
        total_answers = correct_count + incorrect_count
        correct_rate = (correct_count / total_answers * 100) if total_answers > 0 else 0
        
        question_analytics.append({
            'question_text': question.question,
            'correct_count': correct_count,
            'incorrect_count': incorrect_count,
            'correct_rate': round(correct_rate, 1),
        })
    
    # ========== TIME ANALYTICS ==========
    time_analytics = {
        'average_completion_time': 0,
        'fastest_completion': 0,
        'slowest_completion': 0,
    }
    
    if responses:
        times = [r.time_taken for r in responses if r.time_taken > 0]
        if times:
            time_analytics['average_completion_time'] = round(sum(times) / len(times), 1)
            time_analytics['fastest_completion'] = min(times)
            time_analytics['slowest_completion'] = max(times)
    
    # ========== SCORE DISTRIBUTION ==========
    score_ranges = [
        {'min': 0, 'max': 20, 'count': 0, 'label': '0-20%'},
        {'min': 20, 'max': 40, 'count': 0, 'label': '20-40%'},
        {'min': 40, 'max': 60, 'count': 0, 'label': '40-60%'},
        {'min': 60, 'max': 80, 'count': 0, 'label': '60-80%'},
        {'min': 80, 'max': 100, 'count': 0, 'label': '80-100%'}
    ]
    
    for response in responses:
        for range_item in score_ranges:
            if range_item['min'] <= response.percentage < range_item['max'] or \
               (range_item['max'] == 100 and response.percentage == 100):
                range_item['count'] += 1
                break
    
    ranking_data = {
        'enrolled_count': enrolled_count,
        'response_count': total_responses,
        'ranking': ranking,
        'performance_distribution': performance_distribution,
        'question_analytics': question_analytics,
        'time_analytics': time_analytics,
        'score_distribution': score_ranges,
    }
    
    # Gerar PDF em memória (BytesIO)
    buffer = io.BytesIO()
    generate_quiz_report_pdf(
        quiz.to_dict(),
        ranking_data,
        buffer
    )
    buffer.seek(0)
    
    # Enviar arquivo
    return send_file(
        buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'relatorio_quiz_{quiz_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
    )


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


# ==========================================
# SUPORTE PERSONALIZADO
# ==========================================

@quiz_bp.route('/<int:quiz_id>/segment-students', methods=['GET'])
@token_required
def segment_students(current_user, quiz_id):
    """Segmenta alunos por faixa de desempenho"""
    quiz = Quiz.query.get(quiz_id)
    
    if not quiz:
        return jsonify({'success': False, 'error': 'Quiz não encontrado'}), 404
    
    if quiz.created_by != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    responses = QuizResponse.query.filter_by(quiz_id=quiz_id).all()
    
    segments = {
        'critical': [],
        'attention': [],
        'good': [],
        'excellent': []
    }
    
    students_data = []
    
    for response in responses:
        student_data = {
            'id': response.student_id,
            'name': response.student.name if response.student else 'Desconhecido',
            'percentage': response.percentage,
            'score': response.score,
            'total': response.total,
            'performance_level': '',
            'weak_topics': []
        }
        
        if response.percentage < 50:
            student_data['performance_level'] = 'critical'
            segments['critical'].append(response.student_id)
        elif response.percentage < 70:
            student_data['performance_level'] = 'attention'
            segments['attention'].append(response.student_id)
        elif response.percentage < 90:
            student_data['performance_level'] = 'good'
            segments['good'].append(response.student_id)
        else:
            student_data['performance_level'] = 'excellent'
            segments['excellent'].append(response.student_id)
        
        answers = response.answers
        for question in quiz.questions:
            student_answer = answers.get(str(question.id))
            if student_answer is not None and student_answer != question.correct:
                student_data['weak_topics'].append({
                    'question_id': question.id,
                    'question': question.question[:100]
                })
        
        students_data.append(student_data)
    
    return jsonify({
        'success': True,
        'segments': segments,
        'students': students_data,
        'summary': {
            'critical_count': len(segments['critical']),
            'attention_count': len(segments['attention']),
            'good_count': len(segments['good']),
            'excellent_count': len(segments['excellent']),
            'total': len(responses)
        }
    })


@quiz_bp.route('/<int:quiz_id>/generate-support-content', methods=['POST'])
@token_required
def generate_support_content(current_user, quiz_id):
    """Gera conteúdo de suporte personalizado via IA"""
    from app.services.ai_service import generate_quiz_from_content
    
    quiz = Quiz.query.get(quiz_id)
    
    if not quiz:
        return jsonify({'success': False, 'error': 'Quiz não encontrado'}), 404
    
    if quiz.created_by != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    data = request.get_json()
    student_ids = data.get('student_ids', [])
    
    if not student_ids:
        return jsonify({'success': False, 'error': 'Nenhum aluno selecionado'}), 400
    
    responses = QuizResponse.query.filter(
        QuizResponse.quiz_id == quiz_id,
        QuizResponse.student_id.in_(student_ids)
    ).all()
    
    question_errors = {}
    for response in responses:
        answers = response.answers
        for question in quiz.questions:
            student_answer = answers.get(str(question.id))
            if student_answer is not None and student_answer != question.correct:
                if question.id not in question_errors:
                    question_errors[question.id] = {
                        'question': question,
                        'error_count': 0
                    }
                question_errors[question.id]['error_count'] += 1
    
    sorted_errors = sorted(question_errors.items(), key=lambda x: x[1]['error_count'], reverse=True)
    focus_questions = [item[1]['question'] for item in sorted_errors[:3]]
    
    context = f"Quiz Original: {quiz.title}\\n\\n"
    context += "Questões onde os alunos tiveram mais dificuldade:\\n\\n"
    for q in focus_questions:
        context += f"- {q.question}\\n"
        for i, opt in enumerate(q.options):
            context += f"  {chr(65+i)}) {opt}\\n"
        context += f"  Resposta correta: {chr(65+q.correct)}\\n\\n"
    
    prompt = f"""Baseado no quiz abaixo onde os alunos tiveram dificuldades, crie um QUIZ DE REFORÇO com 5 questões MAIS SIMPLES sobre os mesmos tópicos.

{context}

IMPORTANTE:
- As questões devem ser MAIS FÁCEIS que as originais
- Foque nos mesmos conceitos mas com abordagem diferente
- Inclua dicas e explicações
- Seja encorajador e motivacional

Retorne APENAS um JSON válido no formato:
{{
    "title": "Quiz de Reforço - [Tópico]",
    "questions": [
        {{
            "question": "...",
            "options": ["A", "B", "C", "D"],
            "correct": 0,
            "explanation": "Explicação da resposta correta"
        }}
    ]
}}"""
    
    try:
        result = generate_quiz_from_content(prompt, num_questions=5)
        
        if result.get('success'):
            return jsonify({
                'success': True,
                'content': result.get('quiz'),
                'content_type': 'quiz',
                'focus_topics': [q.question[:50] for q in focus_questions]
            })
        else:
            return jsonify({'success': False, 'error': 'Erro ao gerar conteúdo'}), 500
            
    except Exception as e:
        logger.error(f"Erro ao gerar suporte: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@quiz_bp.route('/<int:quiz_id>/send-support', methods=['POST'])
@token_required
def send_support(current_user, quiz_id):
    """Envia conteúdo de suporte para alunos selecionados"""
    from app.models.transcription_session import LiveActivity, TranscriptionSession
    
    quiz = Quiz.query.get(quiz_id)
    
    if not quiz:
        return jsonify({'success': False, 'error': 'Quiz não encontrado'}), 404
    
    if quiz.created_by != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    data = request.get_json()
    student_ids = data.get('student_ids', [])
    content = data.get('content')
    message = data.get('message', 'Material de reforço para ajudar no seu aprendizado!')
    
    if not student_ids or not content:
        return jsonify({'success': False, 'error': 'Dados incompletos'}), 400
    
    session = TranscriptionSession.query.filter_by(
        subject_id=quiz.subject_id,
        teacher_id=current_user.id,
        status='active'
    ).first()
    
    if not session:
        session = TranscriptionSession(
            subject_id=quiz.subject_id,
            teacher_id=current_user.id,
            title=f'Suporte - {quiz.title}',
            status='active'
        )
        db.session.add(session)
        db.session.flush()
    
    support_activity = LiveActivity(
        session_id=session.id,
        activity_type='quiz',
        title=content.get('title', 'Quiz de Reforço'),
        content=content,
        shared_with_students=True,
        status='waiting',
        time_limit=600,
        target_students=student_ids,
        is_support_content=True,
        parent_activity_id=quiz.id if hasattr(quiz, 'id') else None
    )
    
    db.session.add(support_activity)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Conteúdo de suporte enviado para {len(student_ids)} aluno(s)',
        'activity': support_activity.to_dict(),
        'students_notified': len(student_ids)
    })
