"""
Script de teste para as rotas de apresentação
Testa todos os endpoints do backend
"""
import requests
import json

# Configuração
API_URL = "http://localhost:5000/api"

# Token de autenticação (você precisa substituir por um token válido)
# Para obter um token, faça login primeiro
AUTH_TOKEN = "SEU_TOKEN_AQUI"

headers = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

def test_start_presentation():
    """Teste 1: Iniciar apresentação"""
    print("\n🧪 Teste 1: Iniciar apresentação")
    print("=" * 50)
    
    response = requests.post(
        f"{API_URL}/presentation/start",
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    if response.status_code == 200 and data.get('success'):
        print("✅ Apresentação iniciada com sucesso!")
        return data.get('code')
    else:
        print("❌ Falha ao iniciar apresentação")
        return None


def test_get_presentation(code):
    """Teste 2: Obter dados da apresentação (sem auth)"""
    print(f"\n🧪 Teste 2: Obter apresentação com código {code}")
    print("=" * 50)
    
    response = requests.get(f"{API_URL}/presentation/{code}")
    
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    if response.status_code == 200 and data.get('success'):
        print("✅ Dados da apresentação obtidos com sucesso!")
        return True
    else:
        print("❌ Falha ao obter apresentação")
        return False


def test_send_content(code):
    """Teste 3: Enviar conteúdo para apresentação"""
    print(f"\n🧪 Teste 3: Enviar conteúdo para código {code}")
    print("=" * 50)
    
    content = {
        "type": "summary",
        "data": {
            "title": "Teste de Resumo",
            "text": "Este é um teste de envio de conteúdo para a tela de apresentação."
        }
    }
    
    response = requests.post(
        f"{API_URL}/presentation/{code}/send",
        headers=headers,
        json=content
    )
    
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    if response.status_code == 200 and data.get('success'):
        print("✅ Conteúdo enviado com sucesso!")
        return True
    else:
        print("❌ Falha ao enviar conteúdo")
        return False


def test_clear_presentation(code):
    """Teste 4: Limpar tela de apresentação"""
    print(f"\n🧪 Teste 4: Limpar tela para código {code}")
    print("=" * 50)
    
    response = requests.post(
        f"{API_URL}/presentation/{code}/clear",
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    if response.status_code == 200 and data.get('success'):
        print("✅ Tela limpa com sucesso!")
        return True
    else:
        print("❌ Falha ao limpar tela")
        return False


def test_get_active_presentation():
    """Teste 5: Obter sessão ativa do professor"""
    print("\n🧪 Teste 5: Obter sessão ativa")
    print("=" * 50)
    
    response = requests.get(
        f"{API_URL}/presentation/active",
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    if response.status_code == 200 and data.get('success'):
        print("✅ Sessão ativa obtida com sucesso!")
        return True
    else:
        print("❌ Falha ao obter sessão ativa")
        return False


def test_end_presentation(code):
    """Teste 6: Encerrar apresentação"""
    print(f"\n🧪 Teste 6: Encerrar apresentação {code}")
    print("=" * 50)
    
    response = requests.post(
        f"{API_URL}/presentation/{code}/end",
        headers=headers
    )
    
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    if response.status_code == 200 and data.get('success'):
        print("✅ Apresentação encerrada com sucesso!")
        return True
    else:
        print("❌ Falha ao encerrar apresentação")
        return False


def run_all_tests():
    """Executar todos os testes em sequência"""
    print("\n" + "=" * 50)
    print("🚀 INICIANDO TESTES DE API - PRESENTATION")
    print("=" * 50)
    
    if AUTH_TOKEN == "SEU_TOKEN_AQUI":
        print("\n⚠️  ATENÇÃO: Você precisa configurar um token de autenticação!")
        print("1. Faça login no sistema")
        print("2. Copie o token de autenticação")
        print("3. Cole no início deste arquivo (variável AUTH_TOKEN)")
        return
    
    # Teste 1: Iniciar apresentação
    code = test_start_presentation()
    if not code:
        print("\n❌ Testes interrompidos - falha ao iniciar apresentação")
        return
    
    # Teste 2: Obter apresentação
    test_get_presentation(code)
    
    # Teste 3: Enviar conteúdo
    test_send_content(code)
    
    # Teste 4: Limpar tela
    test_clear_presentation(code)
    
    # Teste 5: Obter sessão ativa
    test_get_active_presentation()
    
    # Teste 6: Encerrar apresentação
    test_end_presentation(code)
    
    print("\n" + "=" * 50)
    print("✅ TODOS OS TESTES CONCLUÍDOS!")
    print("=" * 50)


if __name__ == "__main__":
    run_all_tests()
