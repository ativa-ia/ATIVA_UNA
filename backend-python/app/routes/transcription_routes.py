"""
Rotas da API de Transcrição ao Vivo com Atividades
"""
from flask import Blueprint, request, jsonify
from app.middleware.auth_middleware import token_required
from app.models.transcription_session import (
    TranscriptionSession,
    TranscriptionCheckpoint,
    LiveActivity,
    LiveActivityResponse
)
from app.models.enrollment import Enrollment
from app.models.subject import Subject
from app import db
from datetime import datetime
import json

transcription_bp = Blueprint('transcription', __name__)


# ==================== SESSÕES ====================

@transcription_bp.route('/sessions', methods=['POST'])
@token_required
def create_session(current_user):
    """
    Inicia uma nova sessão de transcrição
    
    Body:
    {
        "subject_id": int,
        "title": str (optional)
    }
    """
    data = request.get_json() or {}
    
    subject_id = data.get('subject_id')
    title = data.get('title', 'Transcrição de Aula')
    
    if not subject_id:
        return jsonify({'success': False, 'error': 'ID da disciplina não fornecido'}), 400
    
    # Verificar se já existe sessão ativa
    existing = TranscriptionSession.query.filter_by(
        subject_id=subject_id,
        teacher_id=current_user.id,
        status='active'
    ).first()
    
    if existing:
        return jsonify({
            'success': True,
            'message': 'Sessão existente encontrada',
            'session': existing.to_dict(include_checkpoints=True)
        })
    
    # Criar nova sessão
    session = TranscriptionSession(
        subject_id=subject_id,
        teacher_id=current_user.id,
        title=title,
        status='active'
    )
    db.session.add(session)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Sessão iniciada',
        'session': session.to_dict()
    }), 201


@transcription_bp.route('/sessions/<int:session_id>', methods=['GET'])
@token_required
def get_session(current_user, session_id):
    """Obtém detalhes de uma sessão com checkpoints e atividades"""
    session = TranscriptionSession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    return jsonify({
        'success': True,
        'session': session.to_dict(include_checkpoints=True, include_activities=True)
    })


@transcription_bp.route('/sessions/<int:session_id>', methods=['PUT'])
@token_required
def update_session(current_user, session_id):
    """
    Atualiza a transcrição (auto-save)
    
    Body:
    {
        "full_transcript": str,
        "title": str (optional)
    }
    """
    session = TranscriptionSession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    data = request.get_json() or {}
    
    if 'full_transcript' in data:
        session.full_transcript = data['full_transcript']
    
    if 'title' in data:
        session.title = data['title']
    
    session.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Transcrição salva',
        'word_count': session.word_count
    })


@transcription_bp.route('/sessions/<int:session_id>/checkpoint', methods=['POST'])
@token_required
def create_checkpoint(current_user, session_id):
    """
    Cria um checkpoint (pausa) na transcrição
    
    Body:
    {
        "reason": str (optional) - "quiz", "summary", "open_question"
    }
    """
    session = TranscriptionSession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    data = request.get_json() or {}
    reason = data.get('reason', '')
    
    # Criar checkpoint com snapshot da transcrição atual
    checkpoint = TranscriptionCheckpoint(
        session_id=session_id,
        transcript_at_checkpoint=session.full_transcript,
        word_count=session.word_count,
        reason=reason
    )
    db.session.add(checkpoint)
    
    # Pausar a sessão
    session.status = 'paused'
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Checkpoint criado',
        'checkpoint': checkpoint.to_dict()
    }), 201


@transcription_bp.route('/sessions/<int:session_id>/resume', methods=['PUT'])
@token_required
def resume_session(current_user, session_id):
    """Retoma a sessão após uma atividade"""
    session = TranscriptionSession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    session.status = 'active'
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Sessão retomada',
        'session': session.to_dict()
    })


@transcription_bp.route('/sessions/<int:session_id>/end', methods=['PUT'])
@token_required
def end_session(current_user, session_id):
    """Encerra a sessão de transcrição"""
    session = TranscriptionSession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    session.end()
    
    return jsonify({
        'success': True,
        'message': 'Sessão encerrada',
        'session': session.to_dict(include_checkpoints=True, include_activities=True)
    })


# ==================== GERAÇÃO POR IA ====================

@transcription_bp.route('/sessions/<int:session_id>/generate-quiz', methods=['POST'])
@token_required
def generate_quiz(current_user, session_id):
    """
    Gera quiz via IA baseado na transcrição
    
    Body:
    {
        "num_questions": int (1-10, default 5)
    }
    """
    from app.services.ai_service import generate_quiz_from_text
    
    session = TranscriptionSession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    if not session.full_transcript or len(session.full_transcript.strip()) < 10:
        return jsonify({'success': False, 'error': 'Transcrição muito curta para gerar quiz'}), 400
    
    data = request.get_json() or {}
    num_questions = min(max(data.get('num_questions', 5), 1), 10)
    
    # Criar checkpoint antes da atividade
    checkpoint = TranscriptionCheckpoint(
        session_id=session_id,
        transcript_at_checkpoint=session.full_transcript,
        word_count=session.word_count,
        reason='quiz'
    )
    db.session.add(checkpoint)
    db.session.flush()
    
    try:
        # Gerar quiz via IA com contexto
        subject = Subject.query.get(session.subject_id)
        quiz_data = generate_quiz_from_text(
            session.full_transcript, 
            num_questions, 
            teacher=current_user, 
            subject=subject
        )
        
        # Criar atividade
        activity = LiveActivity(
            session_id=session_id,
            checkpoint_id=checkpoint.id,
            activity_type='quiz',
            title=f'Quiz - {session.title}',
            content=quiz_data,
            ai_generated_content=json.dumps(quiz_data, ensure_ascii=False),
            status='waiting'
        )
        db.session.add(activity)
        
        session.status = 'paused'
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Quiz com {len(quiz_data.get("questions", []))} perguntas gerado',
            'activity': activity.to_dict(),
            'checkpoint': checkpoint.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'Erro ao gerar quiz: {str(e)}'}), 500


@transcription_bp.route('/sessions/<int:session_id>/generate-summary', methods=['POST'])
@token_required
def generate_summary(current_user, session_id):
    """Gera resumo via IA baseado na transcrição"""
    from app.services.ai_service import generate_summary_from_text
    
    session = TranscriptionSession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    if not session.full_transcript or len(session.full_transcript.strip()) < 50:
        return jsonify({'success': False, 'error': 'Transcrição muito curta para gerar resumo'}), 400
    
    # Criar checkpoint
    checkpoint = TranscriptionCheckpoint(
        session_id=session_id,
        transcript_at_checkpoint=session.full_transcript,
        word_count=session.word_count,
        reason='summary'
    )
    db.session.add(checkpoint)
    db.session.flush()
    
    try:
        # Gerar resumo via IA
        subject = Subject.query.get(session.subject_id)
        summary_text = generate_summary_from_text(
            session.full_transcript,
            teacher=current_user,
            subject=subject
        )
        
        # Criar atividade
        activity = LiveActivity(
            session_id=session_id,
            checkpoint_id=checkpoint.id,
            activity_type='summary',
            title=f'Resumo - {session.title}',
            content={'summary_text': summary_text},
            ai_generated_content=summary_text,
            status='waiting',
            shared_with_students=False
        )
        db.session.add(activity)
        
        session.status = 'paused'
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Resumo gerado',
            'activity': activity.to_dict(),
            'checkpoint': checkpoint.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'Erro ao gerar resumo: {str(e)}'}), 500


# ==================== ATIVIDADES ====================

@transcription_bp.route('/sessions/<int:session_id>/activities', methods=['POST'])
@token_required
def create_activity(current_user, session_id):
    """
    Cria atividade manual (pergunta aberta)
    
    Body:
    {
        "activity_type": "open_question",
        "question": str (ou "doubts" ou "feedback" para pré-definidas),
        "time_limit": int (seconds, default 120)
    }
    """
    session = TranscriptionSession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    data = request.get_json() or {}
    activity_type = data.get('activity_type', 'open_question')
    question = data.get('question', 'doubts')
    time_limit = data.get('time_limit', 120)
    
    # Mapear perguntas pré-definidas
    predefined_questions = {
        'doubts': 'Qual sua maior dúvida sobre o conteúdo?',
        'feedback': 'O que poderia melhorar na aula?'
    }
    
    if question in predefined_questions:
        question_text = predefined_questions[question]
    else:
        question_text = question
    
    # Criar checkpoint
    checkpoint = TranscriptionCheckpoint(
        session_id=session_id,
        transcript_at_checkpoint=session.full_transcript,
        word_count=session.word_count,
        reason='open_question'
    )
    db.session.add(checkpoint)
    db.session.flush()
    
    # Criar atividade
    activity = LiveActivity(
        session_id=session_id,
        checkpoint_id=checkpoint.id,
        activity_type='open_question',
        title='Pergunta Aberta',
        content={'question': question_text},
        time_limit=time_limit,
        status='waiting'
    )
    db.session.add(activity)
    
    session.status = 'paused'
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Pergunta criada',
        'activity': activity.to_dict(),
        'checkpoint': checkpoint.to_dict()
    }), 201


@transcription_bp.route('/sessions/<int:session_id>/activities', methods=['GET'])
@token_required
def list_activities(current_user, session_id):
    """Lista todas as atividades de uma sessão"""
    session = TranscriptionSession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    activities = LiveActivity.query.filter_by(session_id=session_id)\
        .order_by(LiveActivity.created_at.desc())\
        .all()
    
    return jsonify({
        'success': True,
        'activities': [a.to_dict(include_responses=True) for a in activities]
    })


@transcription_bp.route('/activities/<int:activity_id>/broadcast', methods=['PUT'])
@token_required
def broadcast_activity(current_user, activity_id):
    """Inicia a atividade para os alunos verem"""
    activity = LiveActivity.query.get(activity_id)
    
    if not activity:
        return jsonify({'success': False, 'error': 'Atividade não encontrada'}), 404
    
    if activity.session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    if activity.status != 'waiting':
        return jsonify({'success': False, 'error': 'Atividade já foi iniciada ou encerrada'}), 400
    
    activity.broadcast()
    
    # Contar alunos matriculados na disciplina
    enrolled_count = Enrollment.query.filter_by(
        subject_id=activity.session.subject_id
    ).count()
    
    return jsonify({
        'success': True,
        'message': f'Atividade iniciada para {enrolled_count} alunos',
        'activity': activity.to_dict(),
        'enrolled_students': enrolled_count
    })


@transcription_bp.route('/activities/<int:activity_id>/share', methods=['PUT'])
@token_required
def share_summary(current_user, activity_id):
    """Compartilha resumo com os alunos"""
    activity = LiveActivity.query.get(activity_id)
    
    if not activity:
        return jsonify({'success': False, 'error': 'Atividade não encontrada'}), 404
    
    if activity.session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    if activity.activity_type != 'summary':
        return jsonify({'success': False, 'error': 'Esta ação é apenas para resumos'}), 400
    
    activity.shared_with_students = True
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Resumo compartilhado com os alunos',
        'activity': activity.to_dict()
    })


@transcription_bp.route('/activities/<int:activity_id>/end', methods=['PUT'])
@token_required
def end_activity(current_user, activity_id):
    """Encerra a atividade"""
    activity = LiveActivity.query.get(activity_id)
    
    if not activity:
        return jsonify({'success': False, 'error': 'Atividade não encontrada'}), 404
    
    if activity.session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    activity.end_activity()
    
    return jsonify({
        'success': True,
        'message': 'Atividade encerrada',
        'activity': activity.to_dict(include_responses=True)
    })


@transcription_bp.route('/activities/<int:activity_id>/ranking', methods=['GET'])
@token_required
def get_ranking(current_user, activity_id):
    """
    Obtém ranking em tempo real para quiz (polling)
    Retorna status de cada aluno: respondeu, acertos/erros
    """
    activity = LiveActivity.query.get(activity_id)
    
    if not activity:
        return jsonify({'success': False, 'error': 'Atividade não encontrada'}), 404
    
    if activity.session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    responses = LiveActivityResponse.query.filter_by(activity_id=activity_id)\
        .order_by(LiveActivityResponse.percentage.desc(), LiveActivityResponse.submitted_at.asc())\
        .all()
    
    # Contar matriculados
    enrolled_count = Enrollment.query.filter_by(
        subject_id=activity.session.subject_id
    ).count()
    
    # Calcular estatísticas
    ranking = []
    for i, resp in enumerate(responses):
        ranking.append({
            'position': i + 1,
            'student_id': resp.student_id,
            'student_name': resp.student.name if resp.student else 'Aluno',
            'score': resp.score,
            'total': resp.total,
            'percentage': resp.percentage,
            'is_correct': resp.is_correct,
            'submitted_at': resp.submitted_at.isoformat() if resp.submitted_at else None
        })
    
    return jsonify({
        'success': True,
        'activity_status': activity.status,
        'time_remaining': activity.time_remaining if activity.is_active else 0,
        'enrolled_count': enrolled_count,
        'response_count': len(responses),
        'response_rate': (len(responses) / enrolled_count * 100) if enrolled_count > 0 else 0,
        'ranking': ranking
    })


# ==================== ROTAS PARA ALUNOS ====================

@transcription_bp.route('/subjects/<int:subject_id>/active', methods=['GET'])
@token_required
def get_active_activity(current_user, subject_id):
    """
    Aluno verifica se há atividade ativa na disciplina (polling)
    """
    # Verificar matrícula
    enrollment = Enrollment.query.filter_by(
        student_id=current_user.id,
        subject_id=subject_id
    ).first()
    
    if not enrollment and current_user.role != 'teacher':
        return jsonify({'success': False, 'error': 'Não matriculado'}), 403
    
    # Buscar atividade ativa que foi compartilhada
    activity = LiveActivity.query.join(TranscriptionSession)\
        .filter(
            TranscriptionSession.subject_id == subject_id,
            LiveActivity.status == 'active',
            LiveActivity.shared_with_students == True
        ).first()
    
    if not activity:
        # Verificar resumo compartilhado (não precisa estar ativo)
        summary = LiveActivity.query.join(TranscriptionSession)\
            .filter(
                TranscriptionSession.subject_id == subject_id,
                LiveActivity.activity_type == 'summary',
                LiveActivity.shared_with_students == True
            ).order_by(LiveActivity.created_at.desc()).first()
        
        if summary:
            return jsonify({
                'success': True,
                'active': False,
                'has_summary': True,
                'summary': summary.to_dict()
            })
        
        return jsonify({
            'success': True,
            'active': False,
            'activity': None
        })
    
    # Verificar se tempo acabou
    if not activity.is_active:
        return jsonify({
            'success': True,
            'active': False,
            'activity': None
        })
    
    # Verificar se já respondeu
    existing_response = LiveActivityResponse.query.filter_by(
        activity_id=activity.id,
        student_id=current_user.id
    ).first()
    
    return jsonify({
        'success': True,
        'active': True,
        'already_answered': existing_response is not None,
        'activity': activity.to_dict()
    })


@transcription_bp.route('/activities/<int:activity_id>/respond', methods=['POST'])
@token_required
def submit_response(current_user, activity_id):
    """
    Aluno envia resposta para uma atividade
    
    Body para Quiz:
    {
        "answers": {
            "0": 2,  // pergunta 0, resposta índice 2
            "1": 0,
            ...
        }
    }
    
    Body para Pergunta Aberta:
    {
        "text": "Minha resposta..."
    }
    """
    activity = LiveActivity.query.get(activity_id)
    
    if not activity:
        return jsonify({'success': False, 'error': 'Atividade não encontrada'}), 404
    
    # Verificar se está ativa
    if not activity.is_active:
        return jsonify({'success': False, 'error': 'Atividade encerrada'}), 400
    
    # Verificar se já respondeu
    existing = LiveActivityResponse.query.filter_by(
        activity_id=activity_id,
        student_id=current_user.id
    ).first()
    
    if existing:
        return jsonify({'success': False, 'error': 'Você já respondeu esta atividade'}), 400
    
    data = request.get_json() or {}
    
    # Montar response_data baseado no tipo
    if activity.activity_type == 'quiz':
        response_data = {'answers': data.get('answers', {})}
    else:  # open_question
        response_data = {'text': data.get('text', '')}
    
    # Criar resposta
    response = LiveActivityResponse(
        activity_id=activity_id,
        student_id=current_user.id,
        response_data=response_data
    )
    db.session.add(response)
    db.session.commit()
    
    # Se for quiz, calcular pontuação
    if activity.activity_type == 'quiz':
        response.calculate_quiz_score()
    
    return jsonify({
        'success': True,
        'message': 'Resposta enviada!',
        'result': response.to_dict()
    })


# ==================== LISTAGEM ====================

@transcription_bp.route('/subjects/<int:subject_id>/sessions', methods=['GET'])
@token_required
def list_sessions(current_user, subject_id):
    """Lista todas as sessões de transcrição de uma disciplina"""
    sessions = TranscriptionSession.query.filter_by(
        subject_id=subject_id,
        teacher_id=current_user.id
    ).order_by(TranscriptionSession.created_at.desc()).all()
    
    return jsonify({
        'success': True,
        'sessions': [s.to_dict() for s in sessions]
    })
