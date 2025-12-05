import requests

# Primeiro, fazer login para pegar o token
login_url = "https://assistente360-360un.vercel.app/api/auth/login"
login_payload = {
    "email": "maria.silva@edu.br",
    "password": "prof123"
}

print("1. Fazendo login...")
login_resp = requests.post(login_url, json=login_payload)
login_data = login_resp.json()
print(f"   Status: {login_resp.status_code}")

if not login_data.get('success'):
    print(f"   Erro no login: {login_data}")
    exit()

token = login_data.get('token')
print(f"   Token obtido: {token[:20]}...")

# Testar o endpoint de chat
print("\n2. Testando chat com IA...")
chat_url = "https://assistente360-360un.vercel.app/api/ai/chat"
chat_payload = {
    "message": "Olá, pode me ajudar?",
    "subject_id": 1
}
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

chat_resp = requests.post(chat_url, json=chat_payload, headers=headers, timeout=30)
print(f"   Status: {chat_resp.status_code}")
print(f"   Response: {chat_resp.text}")
