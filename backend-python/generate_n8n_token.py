"""
Script para gerar token JWT de longa duração para uso no n8n
Token válido por 1 ano para automação
"""
import jwt
import datetime
import os
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

# Configurações
JWT_SECRET = os.getenv('JWT_SECRET', 'dev_secret_key_123456')
USER_ID = 2  # ID do professor
EMAIL = 'prof@ser.com'
ROLE = 'teacher'

# Gerar token com expiração de 1 ano
expiration = datetime.datetime.utcnow() + datetime.timedelta(days=365)

payload = {
    'id': USER_ID,
    'email': EMAIL,
    'role': ROLE,
    'exp': expiration
}

token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')

print("=" * 80)
print("TOKEN JWT PARA N8N (Válido por 1 ano)")
print("=" * 80)
print(f"\nToken: {token}")
print(f"\nExpira em: {expiration.strftime('%Y-%m-%d %H:%M:%S')}")
print("\n" + "=" * 80)
print("\nCONFIGURAÇÃO NO N8N:")
print("=" * 80)
print("\nOpção 1 - Header direto:")
print(f"Authorization: Bearer {token}")
print("\nOpção 2 - Variável de ambiente:")
print(f"TEACHER_AUTH_TOKEN={token}")
print("\n" + "=" * 80)
