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
    valid_types = ['summary', 'quiz', 'podium', 'ranking', 'image', 'video', 'question', 'blank']
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
    try:
        from app.services.websocket_service import emit_presentation_content
        emit_presentation_content(code, session.current_content)
        logger.info(f"Conteúdo enviado para apresentação {code}: {content_type}")
    except Exception as e:
        logger.error(f"Erro ao emitir WebSocket: {e}")
    
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
    try:
        from app.services.websocket_service import emit_presentation_clear
        emit_presentation_clear(code)
    except Exception as e:
        logger.error(f"Erro ao emitir WebSocket: {e}")
    
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
    try:
        from app.services.websocket_service import emit_presentation_ended
        emit_presentation_ended(code)
    except Exception as e:
        logger.error(f"Erro ao emitir WebSocket: {e}")
    
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
        'session': session.to_dict()
    })
