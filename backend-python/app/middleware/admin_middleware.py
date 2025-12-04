from functools import wraps
from flask import request, jsonify
from app.utils.jwt_utils import decode_token
from app.models.user import User

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({
                'success': False,
                'message': 'Token não fornecido'
            }), 401
        
        try:
            token = auth_header.split(' ')[1]
        except IndexError:
            return jsonify({
                'success': False,
                'message': 'Token inválido'
            }), 401
        
        payload = decode_token(token)
        
        if payload is None:
            return jsonify({
                'success': False,
                'message': 'Token inválido ou expirado'
            }), 401
            
        current_user = User.query.get(payload['id'])
        
        if not current_user:
            return jsonify({
                'success': False,
                'message': 'Usuário não encontrado'
            }), 401
            
        if current_user.role != 'admin':
            return jsonify({
                'success': False,
                'message': 'Acesso não autorizado. Requer privilégios de administrador.'
            }), 403
            
        return f(current_user, *args, **kwargs)
        
    return decorated
