"""
Rotas da API de Apresentação/Transmissão
Baseado no padrão de quiz_routes.py
"""
from flask import Blueprint, request, jsonify
from app.middleware.auth_middleware import token_required
from app.models.presentation import PresentationSession
from app import db
from datetime import datetime
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
    valid_types = ['summary', 'quiz', 'podium', 'ranking', 'image', 'video', 'question', 'document', 'blank']
    if content_type not in valid_types:
        return jsonify({'success': False, 'error': 'Tipo de conteúdo inválido'}), 400
    
    # Atualizar conteúdo atual no banco
    session.current_content = {
        'type': content_type,
        'data': content_data,
        'timestamp': datetime.utcnow().isoformat()
    }
    db.session.commit()
    
    # Emitir via WebSocket para todas as telas conectadas
    # (Removido para Polling Strategy)
    # try:
    #     from app.services.websocket_service import emit_presentation_content
    #     emit_presentation_content(code, session.current_content)
    #     logger.info(f"Conteúdo enviado para apresentação {code}: {content_type}")
    # except Exception as e:
    #     logger.error(f"Erro ao emitir WebSocket: {e}")
    
    return jsonify({
        'success': True,
        'message': f'Conteúdo enviado: {content_type}',
        'content': session.current_content
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
    
    # Emitir via WebSocket
    # (Removido para Polling Strategy)
    # try:
    #     from app.services.websocket_service import emit_presentation_clear
    #     emit_presentation_clear(code)
    # except Exception as e:
    #     logger.error(f"Erro ao emitir WebSocket: {e}")
    
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
    
    # Emitir via WebSocket para desconectar telas
    # (Removido para Polling Strategy)
    # try:
    #     from app.services.websocket_service import emit_presentation_ended
    #     emit_presentation_ended(code)
    # except Exception as e:
    #     logger.error(f"Erro ao emitir WebSocket: {e}")
    
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
