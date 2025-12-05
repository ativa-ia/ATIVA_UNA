import requests
import random
import string
import sys

BASE_URL = "https://ativa-ia-9rkb.vercel.app/api"

def generate_random_email():
    return f"test_{''.join(random.choices(string.ascii_lowercase, k=8))}@example.com"

def test_api():
    print(f"🌍 Testando API em: {BASE_URL}")
    
    email = generate_random_email()
    password = "password123"
    
    # 1. Testar Health Check
    try:
        print("\n🏥 Testando Health Check...")
        resp = requests.get("https://ativa-ia-9rkb.vercel.app/health")
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")
    except Exception as e:
        print(f"❌ Erro no Health Check: {e}")

    # 2. Testar Registro
    print(f"\n📝 Tentando registrar usuário: {email}")
    try:
        payload = {
            "email": email,
            "password": password,
            "name": "Test User",
            "role": "student"
        }
        response = requests.post(f"{BASE_URL}/auth/register", json=payload)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 201:
            print("❌ Falha no registro. Abortando teste de login.")
            return
            
        print("✅ Registro com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro na requisição de registro: {e}")
        return

    # 3. Testar Login
    print("\n🔑 Tentando fazer login...")
    try:
        login_payload = {
            "email": email,
            "password": password
        }
        response = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Login com sucesso! O Backend está funcionando perfeitamente! 🚀")
        else:
            print("❌ Falha no login.")
            
    except Exception as e:
        print(f"❌ Erro na requisição de login: {e}")

if __name__ == "__main__":
    test_api()
