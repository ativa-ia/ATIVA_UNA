import jwt
from datetime import datetime, timedelta
from flask import current_app


def generate_token(user):
    """Gerar JWT token para o usuário"""
    payload = {
        'id': user.id,
        'email': user.email,
        'role': user.role,
        'exp': datetime.utcnow() + timedelta(days=current_app.config['JWT_EXPIRATION_DAYS'])
    }
    
    token = jwt.encode(
        payload,
        current_app.config['JWT_SECRET'],
        algorithm='HS256'
    )
    
    return token


def decode_token(token):
    """Decodificar e validar JWT token"""
    try:
        payload = jwt.decode(
            token,
            current_app.config['JWT_SECRET'],
            algorithms=['HS256']
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None  # Token expirado
    except jwt.InvalidTokenError:
        return None  # Token inválido
