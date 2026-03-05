"""
Rotas da API de Apresentação/Transmissão
Baseado no padrão de quiz_routes.py
"""
from flask import Blueprint, request, jsonify
from app.middleware.auth_middleware import token_required
from app.models.presentation import PresentationSession
from app import db
from datetime import datetime
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

presentation_bp = Blueprint('presentation', __name__)


@presentation_bp.route('/start', methods=['POST'])
@token_required
def start_presentation(current_user):
    """
    Professor inicia apresentação
    Retorna código único para acesso
    
    Se já existe sessão ativa: reutiliza
    Se não: cria nova
    """
    # Verificar se já existe sessão ativa do professor
    existing = PresentationSession.query.filter_by(
        teacher_id=current_user.id,
        status='active'
    ).first()
    
    if existing:
        # Reutilizar sessão existente
        logger.info(f"Reutilizando sessão {existing.code} do professor {current_user.id}")
        return jsonify({
            'success': True,
            'session': existing.to_dict(),
            'code': existing.code,
            'url': f'http://localhost:8081/presentation?code={existing.code}',
            'message': 'Sessão ativa reutilizada'
        })
    
    # Criar nova sessão
    code = PresentationSession.generate_code()
    
    session = PresentationSession(
        code=code,
        teacher_id=current_user.id,
        status='active'
    )
    
    db.session.add(session)
    db.session.commit()
    
    logger.info(f"Apresentação iniciada: {code} por professor {current_user.id}")
    
    return jsonify({
        'success': True,
        'session': session.to_dict(),
        'code': code,
        'url': f'http://localhost:8081/presentation?code={code}',
        'message': 'Apresentação iniciada!'
    })


@presentation_bp.route('/<string:code>', methods=['GET'])
def get_presentation(code):
    """
    Qualquer pessoa com o código pode acessar
    Retorna dados da sessão e conteúdo atual
    
    Sem autenticação necessária!
    """
    session = PresentationSession.query.filter_by(code=code).first()
    
    if not session:
        return jsonify({
            'success': False,
            'error': 'Código inválido'
        }), 404
    
    if session.status != 'active':
        return jsonify({
            'success': False,
            'error': 'Apresentação encerrada'
        }), 400
    
    return jsonify({
        'success': True,
        'session': session.to_dict(),
        'current_content': session.current_content
    })


@presentation_bp.route('/<string:code>/status', methods=['GET'])
def get_presentation_status(code):
    """
    Endpoint leve para Polling
    Retorna apenas timestamp e tipo do conteúdo atual
    """
    session = PresentationSession.query.filter_by(code=code).first()
    
    if not session or session.status != 'active':
        return jsonify({
            'success': False,
            'active': False
        })
    
    current = session.current_content or {}
    
    return jsonify({
        'success': True,
        'active': True,
        'timestamp': current.get('timestamp'),
        'type': current.get('type')
    })


@presentation_bp.route('/<string:code>/send', methods=['POST'])
@token_required
def send_content(current_user, code):
    """
    Professor envia conteúdo para a tela
    
    Body:
    {
        "type": "summary" | "quiz" | "podium" | "image" | "video" | "blank",
        "data": { ... }
    }
    """
    session = PresentationSession.query.filter_by(code=code).first()
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    if session.status != 'active':
        return jsonify({'success': False, 'error': 'Sessão encerrada'}), 400
    
    data = request.get_json()
    content_type = data.get('type')
    content_data = data.get('data', {})
    
    # Validar tipo de conteúdo
    valid_types = ['summary', 'quiz', 'podium', 'ranking', 'image', 'video', 'question', 'document', 'document_list', 'blank']
    if content_type not in valid_types:
        return jsonify({'success': False, 'error': 'Tipo de conteúdo inválido'}), 400
    
    # Atualizar conteúdo atual no banco
    session.current_content = {
        'type': content_type,
        'data': content_data,
        'timestamp': datetime.utcnow().isoformat()
    }
    db.session.commit()

    # Registrar evento para o recap da aula
    try:
        from app.routes.lesson_recap_routes import log_lesson_event, find_active_transcription_session
        ts = find_active_transcription_session(current_user.id)
        if ts:
            event_data = {
                'content_type': content_type,
                'title': content_data.get('title') or content_data.get('filename') or content_type,
            }
            # Preservar URL para conteúdos acessíveis
            if content_data.get('url'):
                event_data['url'] = content_data['url']
            if content_data.get('file_url'):
                event_data['url'] = content_data['file_url']
            if content_data.get('supabase_url'):
                event_data['url'] = content_data['supabase_url']
            if content_data.get('metadata'):
                event_data['metadata'] = content_data['metadata']
            log_lesson_event(
                session_id=ts.id,
                event_type='content_displayed',
                event_data=event_data,
                presentation_id=session.id,
                triggered_by=current_user.id
            )
    except Exception as e:
        logger.error(f'[RECAP] Erro ao registrar content_displayed: {e}')
    
    return jsonify({
        'success': True,
        'message': f'Conteúdo enviado: {content_type}',
        'content': session.current_content
    })


@presentation_bp.route('/<string:code>/share-document', methods=['POST'])
@token_required
def share_document_to_students(current_user, code):
    """
    Compartilha o documento atual da apresentacao com os alunos da disciplina.
    Requer que o conteudo atual seja um documento.
    """
    from app.models.enrollment import Enrollment
    from app.models.teaching import Teaching
    from app.models.study_material import StudyMaterial

    session = PresentationSession.query.filter_by(code=code).first()

    if not session:
        return jsonify({'success': False, 'error': 'Sessao nao encontrada'}), 404

    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Nao autorizado'}), 403

    if session.status != 'active':
        return jsonify({'success': False, 'error': 'Sessao encerrada'}), 400

    current = session.current_content or {}
    if current.get('type') != 'document':
        return jsonify({'success': False, 'error': 'Nenhum documento na tela'}), 400

    data = current.get('data') or {}
    subject_id = data.get('subject_id')
    classroom_id = data.get('classroom_id')
    file_url = data.get('supabase_url') or data.get('file_url')
    file_path = data.get('file_path')
    title = data.get('filename') or 'Documento da aula'

    if not subject_id and classroom_id:
        from app.models.subject import Subject
        resolved_subject = None

        try:
            if str(classroom_id).isdigit():
                resolved_subject = Subject.query.get(int(classroom_id))
        except Exception:
            resolved_subject = None

        if not resolved_subject:
            resolved_subject = Subject.query.filter_by(name=classroom_id).first()

        if not resolved_subject:
            resolved_subject = Subject.query.filter_by(code=classroom_id).first()

        if resolved_subject:
            subject_id = resolved_subject.id

    if not subject_id and file_url:
        from app.models.ai_session import AIContextFile
        context_file = AIContextFile.query.filter_by(file_url=file_url).first()
        if context_file:
            subject_id = context_file.subject_id

    if not subject_id and file_path:
        from app.models.ai_session import AIContextFile
        context_file = AIContextFile.query.filter_by(file_path=file_path).first()
        if context_file:
            subject_id = context_file.subject_id

    if not subject_id:
        return jsonify({'success': False, 'error': 'Documento sem disciplina vinculada'}), 400

    if not file_url:
        return jsonify({'success': False, 'error': 'Documento sem URL compartilhavel'}), 400

    teaching = Teaching.query.filter_by(
        teacher_id=current_user.id,
        subject_id=subject_id
    ).first()

    if not teaching:
        return jsonify({'success': False, 'error': 'Sem permissao para esta disciplina'}), 403

    enrollments = Enrollment.query.filter_by(subject_id=subject_id).all()
    if not enrollments:
        return jsonify({'success': True, 'message': 'Nenhum aluno matriculado', 'count': 0})

    def _infer_material_type(filename: str, url: str, path: str) -> str:
        filename = (filename or '').lower()
        path = (path or '').lower()
        url_path = ''
        try:
            url_path = (urlparse(url).path or '').lower() if url else ''
        except Exception:
            url_path = (url or '').lower()

        if filename.endswith('.pdf') or path.endswith('.pdf') or url_path.endswith('.pdf'):
            return 'pdf'
        if filename.endswith('.md') or filename.endswith('.txt') or path.endswith('.md') or path.endswith('.txt') or url_path.endswith('.md') or url_path.endswith('.txt'):
            return 'document'
        return 'pdf'

    material_type = _infer_material_type(title, file_url, file_path)

    count = 0
    for enrollment in enrollments:
        material = StudyMaterial(
            student_id=enrollment.student_id,
            subject_id=subject_id,
            activity_id=None,
            title=title,
            type=material_type,
            content_url=file_url,
            file_size=None
        )
        db.session.add(material)
        count += 1

    db.session.commit()

    # Registrar evento de compartilhamento
    try:
        from app.routes.lesson_recap_routes import log_lesson_event, find_active_transcription_session
        ts = find_active_transcription_session(current_user.id)
        if ts:
            log_lesson_event(
                session_id=ts.id,
                event_type='document_shared',
                event_data={
                    'filename': title,
                    'url': file_url,
                    'student_count': count
                },
                presentation_id=session.id,
                triggered_by=current_user.id
            )
    except Exception as e:
        logger.error(f'[RECAP] Erro ao registrar document_shared: {e}')

    return jsonify({
        'success': True,
        'message': f'Documento enviado para {count} aluno(s)',
        'count': count
    })


@presentation_bp.route('/<string:code>/share-video', methods=['POST'])
@token_required
def share_video_to_students(current_user, code):
    """
    Compartilha o video atual da apresentacao com os alunos da disciplina.
    Requer que o conteudo atual seja um video.
    """
    from app.models.enrollment import Enrollment
    from app.models.teaching import Teaching
    from app.models.study_material import StudyMaterial
    from app.models.subject import Subject

    session = PresentationSession.query.filter_by(code=code).first()

    if not session:
        return jsonify({'success': False, 'error': 'Sessao nao encontrada'}), 404

    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Nao autorizado'}), 403

    if session.status != 'active':
        return jsonify({'success': False, 'error': 'Sessao encerrada'}), 400

    current = session.current_content or {}
    if current.get('type') != 'video':
        return jsonify({'success': False, 'error': 'Nenhum video na tela'}), 400

    data = current.get('data') or {}
    req_data = request.get_json(silent=True) or {}

    subject_id = req_data.get('subject_id') or data.get('subject_id')
    classroom_id = req_data.get('classroom_id') or data.get('classroom_id')
    video_url = data.get('url') or data.get('video_url') or data.get('content_url')
    title = req_data.get('title') or data.get('caption') or data.get('title') or 'Video da aula'

    if not subject_id and classroom_id:
        resolved_subject = None

        try:
            if str(classroom_id).isdigit():
                resolved_subject = Subject.query.get(int(classroom_id))
        except Exception:
            resolved_subject = None

        if not resolved_subject:
            resolved_subject = Subject.query.filter_by(name=classroom_id).first()

        if not resolved_subject:
            resolved_subject = Subject.query.filter_by(code=classroom_id).first()

        if resolved_subject:
            subject_id = resolved_subject.id

    if not subject_id:
        try:
            from app.routes.lesson_recap_routes import find_active_transcription_session
            transcription_session = find_active_transcription_session(current_user.id)
            if transcription_session:
                subject_id = transcription_session.subject_id
        except Exception as e:
            logger.error(f'[SHARE VIDEO] Erro ao resolver disciplina por sessao ativa: {e}')

    if not subject_id:
        return jsonify({'success': False, 'error': 'Video sem disciplina vinculada'}), 400

    if not video_url:
        return jsonify({'success': False, 'error': 'Video sem URL compartilhavel'}), 400

    teaching = Teaching.query.filter_by(
        teacher_id=current_user.id,
        subject_id=subject_id
    ).first()

    if not teaching:
        return jsonify({'success': False, 'error': 'Sem permissao para esta disciplina'}), 403

    enrollments = Enrollment.query.filter_by(subject_id=subject_id).all()
    if not enrollments:
        return jsonify({'success': True, 'message': 'Nenhum aluno matriculado', 'count': 0})

    count = 0
    for enrollment in enrollments:
        material = StudyMaterial(
            student_id=enrollment.student_id,
            subject_id=subject_id,
            activity_id=None,
            title=title,
            type='video',
            content_url=video_url,
            file_size=None
        )
        db.session.add(material)
        count += 1

    db.session.commit()

    try:
        from app.routes.lesson_recap_routes import log_lesson_event, find_active_transcription_session
        ts = find_active_transcription_session(current_user.id)
        if ts:
            log_lesson_event(
                session_id=ts.id,
                event_type='video_shared',
                event_data={
                    'title': title,
                    'url': video_url,
                    'student_count': count
                },
                presentation_id=session.id,
                triggered_by=current_user.id
            )
    except Exception as e:
        logger.error(f'[RECAP] Erro ao registrar video_shared: {e}')

    return jsonify({
        'success': True,
        'message': f'Video enviado para {count} aluno(s)',
        'count': count
    })


@presentation_bp.route('/<string:code>/clear', methods=['POST'])
@token_required
def clear_presentation(current_user, code):
    """
    Professor limpa/oculta conteúdo da tela
    """
    session = PresentationSession.query.filter_by(code=code).first()
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    # Limpar conteúdo
    session.current_content = {
        'type': 'blank',
        'data': {},
        'timestamp': datetime.utcnow().isoformat()
    }
    db.session.commit()

    # Registrar evento
    try:
        from app.routes.lesson_recap_routes import log_lesson_event, find_active_transcription_session
        ts = find_active_transcription_session(current_user.id)
        if ts:
            log_lesson_event(
                session_id=ts.id,
                event_type='content_cleared',
                presentation_id=session.id,
                triggered_by=current_user.id
            )
    except Exception as e:
        logger.error(f'[RECAP] Erro ao registrar content_cleared: {e}')
    
    return jsonify({
        'success': True,
        'message': 'Tela limpa'
    })


@presentation_bp.route('/<string:code>/end', methods=['POST'])
@token_required
def end_presentation(current_user, code):
    """
    Professor encerra a apresentação
    """
    session = PresentationSession.query.filter_by(code=code).first()
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    session.end_session()

    # Registrar evento
    try:
        from app.routes.lesson_recap_routes import log_lesson_event, find_active_transcription_session
        ts = find_active_transcription_session(current_user.id)
        if ts:
            log_lesson_event(
                session_id=ts.id,
                event_type='presentation_ended',
                event_data={'presentation_code': code},
                presentation_id=session.id,
                triggered_by=current_user.id
            )
    except Exception as e:
        logger.error(f'[RECAP] Erro ao registrar presentation_ended: {e}')
    
    logger.info(f"Apresentação encerrada: {code}")
    
    return jsonify({
        'success': True,
        'message': 'Apresentação encerrada'
    })


@presentation_bp.route('/active', methods=['GET'])
@token_required
def get_active_presentation(current_user):
    """
    Retorna sessão ativa do professor (se existir)
    Útil para manter estado entre telas
    """
    session = PresentationSession.query.filter_by(
        teacher_id=current_user.id,
        status='active'
    ).first()
    
    if not session:
        return jsonify({
            'success': True,
            'active': False,
            'session': None
        })

    return jsonify({
        'success': True,
        'active': True,
        'session': session.to_dict(),
        'code': session.code,
        'url': f'http://localhost:8081/presentation?code={session.code}'
    })
    

@presentation_bp.route('/<code_or_id>/control', methods=['POST'])
@token_required
def control_content(current_user, code_or_id):
    """
    Controla o conteúdo da apresentação (ex: Play/Pause vídeo)
    """
    data = request.json
    command = data.get('command')
    value = data.get('value')
    
    if not command:
        return jsonify({'error': 'Command invalid'}), 400
        
    session = None
    if code_or_id.isdigit() and len(code_or_id) < 5: 
        session = PresentationSession.query.get(int(code_or_id))
    else:
        session = PresentationSession.query.filter_by(code=code_or_id, status='active').first()
        
    if not session:
        return jsonify({'error': 'Presentation session not found'}), 404
    
    # Validation (optional: check ownership)
    if session.teacher_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
        
    # Persistir estado do vídeo
    if not session.current_content:
        session.current_content = {}

    session.current_content.update({
        'video_control': {
            'command': command,
            'value': value,
            'timestamp': datetime.utcnow().isoformat()
        }
    })
    
    # IMPORTANTE: Atualizar timestamp principal para o Polling detectar mudança
    session.current_content['timestamp'] = datetime.utcnow().isoformat()
    
    # Forçar detecção de mudança pelo SQLAlchemy (JSON mutable)
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(session, "current_content")
    
    db.session.commit()
    
    logger.info(f"Comando de vídeo persistido para {session.code}: {command}")
    
    return jsonify({'success': True, 'message': f'Command {command} saved'})
