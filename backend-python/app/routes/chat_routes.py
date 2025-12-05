"""
Rotas da API de Chat
"""
from flask import Blueprint, request, jsonify
from app.middleware.auth_middleware import token_required
from app.models.chat import ChatMessage
from app import db

chat_bp = Blueprint('chat', __name__)


@chat_bp.route('/history/<int:subject_id>', methods=['GET'])
@token_required
def get_chat_history(current_user, subject_id):
    """
    Retorna o histórico de chat do usuário para uma disciplina
    """
    try:
        messages = ChatMessage.get_history(current_user.id, subject_id, limit=50)
        
        return jsonify({
            'success': True,
            'messages': [m.to_dict() for m in messages]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@chat_bp.route('/save', methods=['POST'])
@token_required
def save_message(current_user):
    """
    Salva uma mensagem no histórico
    
    Body:
    {
        "subject_id": int,
        "content": str,
        "is_user": bool
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
    
    subject_id = data.get('subject_id')
    content = data.get('content')
    is_user = data.get('is_user', True)
    
    if not subject_id or not content:
        return jsonify({'success': False, 'error': 'subject_id e content são obrigatórios'}), 400
    
    try:
        message = ChatMessage(
            user_id=current_user.id,
            subject_id=subject_id,
            content=content,
            is_user=is_user
        )
        db.session.add(message)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': message.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


@chat_bp.route('/clear/<int:subject_id>', methods=['DELETE'])
@token_required
def clear_chat(current_user, subject_id):
    """
    Limpa todo o histórico de chat do usuário para uma disciplina
    """
    try:
        ChatMessage.clear_history(current_user.id, subject_id)
        
        return jsonify({
            'success': True,
            'message': 'Histórico limpo com sucesso'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
