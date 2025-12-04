from functools import wraps
from flask import request, jsonify
from app.utils.jwt_utils import decode_token
from app.models.user import User


def token_required(f):
    """Decorator para proteger rotas que requerem autenticação"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Pegar token do header Authorization
        auth_header = request.headers.get('Authorization')
        print(f"[AUTH DEBUG] Header: {auth_header[:50] if auth_header else 'None'}...")
        
        if not auth_header:
            return jsonify({
                'success': False,
                'message': 'Token não fornecido'
            }), 401
        
        # Formato: "Bearer TOKEN"
        try:
            token = auth_header.split(' ')[1]
            print(f"[AUTH DEBUG] Token extraído: {token[:20]}...")
        except IndexError:
            return jsonify({
                'success': False,
                'message': 'Token inválido'
            }), 401
        
        # Decodificar token
        payload = decode_token(token)
        print(f"[AUTH DEBUG] Payload: {payload}")
        
        if payload is None:
            return jsonify({
                'success': False,
                'message': 'Token inválido ou expirado'
            }), 401
        
        # Buscar usuário
        current_user = User.find_by_id(payload['id'])
        
        if not current_user:
            return jsonify({
                'success': False,
                'message': 'Usuário não encontrado'
            }), 401
        
        # Passar usuário para a função
        return f(current_user, *args, **kwargs)
    
    return decorated


def role_required(*roles):
    """Decorator para verificar role específico"""
    def decorator(f):
        @wraps(f)
        def decorated(current_user, *args, **kwargs):
            if current_user.role not in roles:
                return jsonify({
                    'success': False,
                    'message': 'Acesso negado. Permissão insuficiente.'
                }), 403
            
            return f(current_user, *args, **kwargs)
        
        return decorated
    
    return decorator
