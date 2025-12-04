"""
Rotas da API de IA
"""
from flask import Blueprint, request, jsonify, Response, stream_with_context
from app.middleware.auth_middleware import token_required
from app.services.ai_service import chat_with_gemini, chat_stream, create_or_get_session
from app.models.ai_session import AISession, AIMessage

ai_bp = Blueprint('ai', __name__)


@ai_bp.route('/chat', methods=['POST'])
@token_required
def chat(current_user):
    """
    Endpoint para chat com IA
    
    Body:
    {
        "message": "string",
        "subject_id": int,
        "stream": bool (optional)
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
    
    message = data.get('message')
    subject_id = data.get('subject_id')
    stream = data.get('stream', False)
    
    if not message:
        return jsonify({'success': False, 'error': 'Mensagem não fornecida'}), 400
    
    if not subject_id:
        return jsonify({'success': False, 'error': 'ID da disciplina não fornecido'}), 400
    
    if stream:
        # Resposta em streaming
        def generate():
            for chunk in chat_stream(current_user.id, subject_id, message):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        
        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            }
        )
    else:
        # Resposta normal
        response = chat_with_gemini(current_user.id, subject_id, message)
        return jsonify({
            'success': True,
            'response': response
        })


@ai_bp.route('/session/<int:subject_id>', methods=['GET'])
@token_required
def get_session(current_user, subject_id):
    """Retorna ou cria sessão ativa para a disciplina"""
    session = create_or_get_session(current_user.id, subject_id)
    return jsonify({
        'success': True,
        'session': session.to_dict()
    })


@ai_bp.route('/session/<int:session_id>/messages', methods=['GET'])
@token_required
def get_messages(current_user, session_id):
    """Retorna mensagens de uma sessão"""
    session = AISession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    messages = AIMessage.query.filter_by(session_id=session_id)\
        .order_by(AIMessage.created_at.asc())\
        .all()
    
    return jsonify({
        'success': True,
        'messages': [m.to_dict() for m in messages]
    })


@ai_bp.route('/session/<int:session_id>/end', methods=['POST'])
@token_required
def end_session(current_user, session_id):
    """Encerra uma sessão de chat"""
    from datetime import datetime
    from app import db
    
    session = AISession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    session.status = 'ended'
    session.ended_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Sessão encerrada'
    })
