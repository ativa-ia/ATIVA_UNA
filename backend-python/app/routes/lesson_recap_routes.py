"""
Rotas da API de Recap da Aula (Lesson Recap)
Consolida todos os eventos de uma aula em um recap completo.
"""
from flask import Blueprint, request, jsonify
from app.middleware.auth_middleware import token_required
from app.models.lesson_recap import LessonEvent, LessonRecap
from app.models.transcription_session import (
    TranscriptionSession,
    LiveActivity,
    LiveActivityResponse
)
from app.models.enrollment import Enrollment
from app import db
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)

lesson_recap_bp = Blueprint('lesson_recap', __name__)


# ==================== HELPER: REGISTRAR EVENTO ====================

def log_lesson_event(session_id, event_type, event_data=None,
                     presentation_id=None, activity_id=None, triggered_by=None):
    """
    Registra um evento na tabela lesson_events.
    Utilidade chamada de qualquer rota que precise logar.
    Silenciosa em caso de erro (não interrompe a rota principal).
    """
    try:
        event = LessonEvent(
            session_id=session_id,
            presentation_id=presentation_id,
            event_type=event_type,
            event_data=event_data or {},
            activity_id=activity_id,
            triggered_by=triggered_by,
            occurred_at=datetime.utcnow()
        )
        db.session.add(event)
        db.session.commit()
        logger.info(f"[RECAP] Evento registrado: {event_type} (session={session_id})")
        return event
    except Exception as e:
        logger.error(f"[RECAP] Erro ao registrar evento {event_type}: {e}")
        db.session.rollback()
        return None


def find_active_transcription_session(teacher_id):
    """Encontra a sessão de transcrição ativa do professor (se houver)."""
    return TranscriptionSession.query.filter(
        TranscriptionSession.teacher_id == teacher_id,
        TranscriptionSession.status.in_(['active', 'paused'])
    ).order_by(TranscriptionSession.id.desc()).first()


# ==================== GERAÇÃO DO RECAP ====================

def _build_recap_data(session, events):
    """Constrói o recap_data estruturado a partir dos eventos."""

    # Timeline dos eventos
    timeline = []
    contents_shown = []
    activities_performed = []

    for event in events:
        entry = {
            'time': event.occurred_at.strftime('%H:%M') if event.occurred_at else None,
            'type': event.event_type,
            'description': _event_description(event),
            'data': event.event_data,
        }
        if event.activity_id:
            entry['activity_id'] = event.activity_id
        timeline.append(entry)

        # Acumular conteúdos exibidos
        if event.event_type == 'content_displayed':
            content_info = {
                'type': event.event_data.get('content_type', 'unknown'),
                'title': event.event_data.get('title', 'Conteúdo'),
                'shown_at': event.occurred_at.strftime('%H:%M') if event.occurred_at else None,
            }
            # Preservar URL se for vídeo, documento, etc.
            if event.event_data.get('url'):
                content_info['url'] = event.event_data['url']
            if event.event_data.get('metadata'):
                content_info['metadata'] = event.event_data['metadata']
            contents_shown.append(content_info)

        # Acumular atividades
        if event.event_type in ('quiz_broadcast', 'summary_shared', 'open_question_created'):
            act_info = {
                'type': event.event_data.get('activity_type', event.event_type),
                'title': event.event_data.get('title', ''),
                'activity_id': event.activity_id,
            }
            # Buscar estatísticas de participação
            if event.activity_id:
                activity = LiveActivity.query.get(event.activity_id)
                if activity:
                    total_responses = len(activity.responses) if activity.responses else 0
                    enrolled = Enrollment.query.filter_by(
                        subject_id=session.subject_id
                    ).count()
                    act_info['response_count'] = total_responses
                    act_info['enrolled_count'] = enrolled
                    act_info['participation_rate'] = round(
                        (total_responses / enrolled * 100) if enrolled > 0 else 0, 1
                    )
                    # Média de pontuação p/ quiz
                    if activity.activity_type == 'quiz' and activity.responses:
                        scores = [r.percentage for r in activity.responses if r.percentage is not None]
                        if scores:
                            act_info['average_score'] = round(sum(scores) / len(scores), 1)

            activities_performed.append(act_info)

    # Estatísticas gerais
    duration_minutes = None
    if session.started_at and session.ended_at:
        delta = session.ended_at - session.started_at
        duration_minutes = round(delta.total_seconds() / 60, 1)

    key_statistics = {
        'total_words_transcribed': session.word_count,
        'duration_minutes': duration_minutes,
        'total_events': len(events),
        'total_contents_displayed': len(contents_shown),
        'total_activities': len(activities_performed),
    }

    return {
        'duration_minutes': duration_minutes,
        'timeline': timeline,
        'contents_shown': contents_shown,
        'activities_performed': activities_performed,
        'key_statistics': key_statistics,
    }


def _event_description(event):
    """Gera descrição legível para cada tipo de evento."""
    desc_map = {
        'transcription_start': 'Início da transcrição',
        'transcription_end': 'Encerramento da transcrição',
        'checkpoint': f"Checkpoint: {event.event_data.get('reason', 'pausa')}",
        'quiz_generated': f"Quiz gerado: {event.event_data.get('title', '')}",
        'quiz_broadcast': f"Quiz enviado aos alunos: {event.event_data.get('title', '')}",
        'summary_generated': f"Resumo gerado: {event.event_data.get('title', '')}",
        'summary_shared': f"Resumo compartilhado: {event.event_data.get('title', '')}",
        'open_question_created': f"Pergunta aberta: {event.event_data.get('title', '')}",
        'content_displayed': f"Conteúdo exibido: {event.event_data.get('content_type', '')} - {event.event_data.get('title', '')}",
        'content_cleared': 'Tela limpa',
        'document_shared': f"Documento compartilhado: {event.event_data.get('filename', '')}",
        'audio_generated': f"Áudio gerado: {event.event_data.get('title', '')}",
        'presentation_ended': 'Apresentação encerrada',
    }
    return desc_map.get(event.event_type, event.event_type)


def generate_recap_for_session(session_id):
    """
    Gera o recap completo para uma sessão.
    Chamado automaticamente ao encerrar a sessão ou manualmente.
    """
    from app.services.ai_service import generate_content_with_prompt

    session = TranscriptionSession.query.get(session_id)
    if not session:
        logger.error(f"[RECAP] Sessão {session_id} não encontrada")
        return None

    # Verificar se já existe recap
    existing = LessonRecap.query.filter_by(session_id=session_id).first()
    if existing:
        # Regenerar: atualizar o existente
        recap = existing
        recap.status = 'generating'
        db.session.commit()
    else:
        # Criar novo recap
        recap = LessonRecap(
            session_id=session_id,
            subject_id=session.subject_id,
            teacher_id=session.teacher_id,
            title=session.title or 'Recap da Aula',
            status='generating'
        )
        db.session.add(recap)
        db.session.commit()

    try:
        # Buscar eventos
        events = LessonEvent.query.filter_by(session_id=session_id)\
            .order_by(LessonEvent.occurred_at).all()

        # Construir dados estruturados
        recap_data = _build_recap_data(session, events)

        # Gerar resumo via IA
        subject_name = session.subject.name if session.subject else 'Aula'
        ai_summary, ai_title = _generate_ai_recap(session, recap_data, subject_name)

        # Atualizar recap
        recap.title = ai_title or session.title or 'Recap da Aula'
        recap.ai_summary = ai_summary
        recap.recap_data = recap_data
        recap.status = 'ready'
        recap.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info(f"[RECAP] Recap gerado com sucesso para sessão {session_id}")
        return recap

    except Exception as e:
        logger.error(f"[RECAP] Erro ao gerar recap: {e}")
        recap.status = 'error'
        recap.ai_summary = f"Erro na geração: {str(e)}"
        db.session.commit()
        return recap


def _generate_ai_recap(session, recap_data, subject_name):
    """Gera o resumo narrativo e título via IA."""
    from app.services.ai_service import generate_content_with_prompt

    # Montar contexto para a IA
    contents_list = ""
    for i, c in enumerate(recap_data.get('contents_shown', []), 1):
        contents_list += f"\n  {i}. [{c.get('type', '?')}] {c.get('title', 'Sem título')} (exibido às {c.get('shown_at', '?')})"

    activities_list = ""
    for i, a in enumerate(recap_data.get('activities_performed', []), 1):
        participation = f" - {a.get('participation_rate', 0)}% de participação" if a.get('participation_rate') else ""
        avg_score = f" - média: {a.get('average_score', 0)}%" if a.get('average_score') else ""
        activities_list += f"\n  {i}. [{a.get('type', '?')}] {a.get('title', '')}{participation}{avg_score}"

    stats = recap_data.get('key_statistics', {})
    duration = stats.get('duration_minutes', '?')
    word_count = stats.get('total_words_transcribed', 0)

    # Trecho da transcrição (início)
    transcript_snippet = ""
    if session.full_transcript:
        words = session.full_transcript.split()
        # Pegar primeiras 300 palavras como contexto
        transcript_snippet = ' '.join(words[:300])
        if len(words) > 300:
            transcript_snippet += "..."

    system_prompt = """Você é um assistente pedagógico que gera recaps de aulas.
Seu objetivo é criar:
1. Um TÍTULO conciso e informativo para a aula (máx 80 caracteres)
2. Um RESUMO NARRATIVO do que aconteceu na aula (3-5 parágrafos)

O resumo deve descrever a DINÂMICA da aula (o que o professor fez, que materiais mostrou, que atividades aplicou), 
NÃO repetir o conteúdo da transcrição. Deve ser útil para um aluno que faltou entender o que perdeu.

Responda SEMPRE no formato JSON:
{
  "title": "string com título da aula",
  "summary": "string com resumo narrativo"
}"""

    user_prompt = f"""Disciplina: {subject_name}
Duração: {duration} minutos
Palavras transcritas: {word_count}

Conteúdos exibidos na tela:{contents_list if contents_list else ' Nenhum conteúdo exibido'}

Atividades realizadas:{activities_list if activities_list else ' Nenhuma atividade realizada'}

Trecho inicial da transcrição (para contexto do tema):
{transcript_snippet if transcript_snippet else 'Sem transcrição disponível'}

Gere o recap no formato JSON especificado."""

    try:
        result = generate_content_with_prompt(system_prompt, user_prompt, json_mode=True)
        parsed = json.loads(result)
        return parsed.get('summary', ''), parsed.get('title', '')
    except Exception as e:
        logger.error(f"[RECAP] Erro na IA: {e}")
        return None, None


# ==================== ROTAS ====================

@lesson_recap_bp.route('/generate/<int:session_id>', methods=['POST'])
@token_required
def generate_recap(current_user, session_id):
    """
    Gera (ou regenera) o recap de uma sessão.
    Pode ser chamado manualmente pelo professor.
    """
    session = TranscriptionSession.query.get(session_id)

    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404

    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403

    recap = generate_recap_for_session(session_id)

    if not recap:
        return jsonify({'success': False, 'error': 'Erro ao gerar recap'}), 500

    return jsonify({
        'success': True,
        'message': 'Recap gerado com sucesso',
        'recap': recap.to_dict(include_events=True)
    })


@lesson_recap_bp.route('/session/<int:session_id>', methods=['GET'])
@token_required
def get_recap_by_session(current_user, session_id):
    """Obtém recap de uma sessão específica."""
    recap = LessonRecap.query.filter_by(session_id=session_id).first()

    if not recap:
        return jsonify({'success': False, 'error': 'Recap não encontrado'}), 404

    # Aluno só acessa se compartilhado
    if current_user.role == 'student' and not recap.shared_with_students:
        return jsonify({'success': False, 'error': 'Recap ainda não compartilhado'}), 403

    return jsonify({
        'success': True,
        'recap': recap.to_dict(include_events=True)
    })


@lesson_recap_bp.route('/subject/<int:subject_id>', methods=['GET'])
@token_required
def list_recaps_by_subject(current_user, subject_id):
    """Lista recaps de uma disciplina."""
    query = LessonRecap.query.filter_by(subject_id=subject_id, status='ready')

    # Aluno só vê recaps compartilhados
    if current_user.role == 'student':
        query = query.filter_by(shared_with_students=True)

    recaps = query.order_by(LessonRecap.created_at.desc()).all()

    return jsonify({
        'success': True,
        'recaps': [r.to_dict() for r in recaps],
        'count': len(recaps)
    })


@lesson_recap_bp.route('/<int:recap_id>/share', methods=['POST'])
@token_required
def share_recap(current_user, recap_id):
    """Compartilha recap com os alunos da disciplina."""
    recap = LessonRecap.query.get(recap_id)

    if not recap:
        return jsonify({'success': False, 'error': 'Recap não encontrado'}), 404

    if recap.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403

    recap.shared_with_students = True
    recap.shared_at = datetime.utcnow()
    db.session.commit()

    # Notificar alunos
    try:
        from app.routes.transcription_routes import _fanout_user_notifications
        subject_name = recap.subject.name if recap.subject else 'Disciplina'
        _fanout_user_notifications(
            subject_id=recap.subject_id,
            title=f'📋 Recap da Aula: {recap.title}',
            message=f'O professor disponibilizou o recap da aula de {subject_name}.',
            notif_type='recap',
            source_type='lesson_recap',
            source_id=recap.id,
        )
        db.session.commit()
    except Exception as e:
        logger.error(f"[RECAP] Erro ao notificar alunos: {e}")

    return jsonify({
        'success': True,
        'message': 'Recap compartilhado com os alunos',
        'recap': recap.to_dict()
    })


@lesson_recap_bp.route('/<int:recap_id>', methods=['GET'])
@token_required
def get_recap(current_user, recap_id):
    """Obtém um recap por ID."""
    recap = LessonRecap.query.get(recap_id)

    if not recap:
        return jsonify({'success': False, 'error': 'Recap não encontrado'}), 404

    # Aluno só acessa se compartilhado
    if current_user.role == 'student' and not recap.shared_with_students:
        return jsonify({'success': False, 'error': 'Recap ainda não compartilhado'}), 403

    return jsonify({
        'success': True,
        'recap': recap.to_dict(include_events=True)
    })
