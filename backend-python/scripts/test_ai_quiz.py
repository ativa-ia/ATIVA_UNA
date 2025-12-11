# -*- coding: utf-8 -*-
"""
Script rapido para testar se a IA está gerando quiz real ou fallback
"""
import requests
import json

# Configuracao
BASE_URL = "https://ativa-ia-9rkb.vercel.app/api"
PROFESSOR_EMAIL = "maria.silva@edu.br"
PROFESSOR_PASSWORD = "prof123"

def test_ai_quiz():
    print("=" * 60)
    print("TESTE: Verificar se IA esta gerando quiz")
    print("=" * 60)

    # Login
    print("\n1. Login...")
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": PROFESSOR_EMAIL,
        "password": PROFESSOR_PASSWORD
    })
    login_data = login_resp.json()
    if not login_data.get('success'):
        print(f"[ERRO] Login falhou: {login_data}")
        return
    
    token = login_data.get('token')
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print(f"   [OK] Logado como: {login_data.get('user', {}).get('name')}")

    # Criar sessao
    print("\n2. Criar sessao...")
    session_resp = requests.post(f"{BASE_URL}/transcription/sessions",
        json={"subject_id": 1, "title": "Teste IA"},
        headers=headers
    )
    session_id = session_resp.json().get('session', {}).get('id')
    print(f"   [OK] Sessao criada: ID={session_id}")

    # Adicionar transcricao
    print("\n3. Adicionar transcricao...")
    texto = """
    Hoje vamos estudar sobre Python, uma linguagem de programacao muito popular.
    Variaveis sao usadas para armazenar valores. Por exemplo: x = 10.
    Listas sao usadas para guardar multiplos valores: frutas = ['maca', 'banana'].
    Funcoes ajudam a organizar o codigo e evitar repeticao.
    """
    update_resp = requests.put(f"{BASE_URL}/transcription/sessions/{session_id}",
        json={"full_transcript": texto},
        headers=headers
    )
    print(f"   [OK] Transcricao salva")

    # Gerar Quiz
    print("\n4. Gerando Quiz via IA...")
    quiz_resp = requests.post(f"{BASE_URL}/transcription/sessions/{session_id}/generate-quiz",
        json={"num_questions": 3},
        headers=headers
    )
    quiz_data = quiz_resp.json()

    print("\n" + "=" * 60)
    print("RESPOSTA DO QUIZ:")
    print("=" * 60)
    
    if quiz_data.get('success'):
        activity = quiz_data.get('activity', {})
        questions = activity.get('content', {}).get('questions', [])
        
        print(f"\nTotal de perguntas: {len(questions)}")
        
        for i, q in enumerate(questions):
            print(f"\n--- PERGUNTA {i+1} ---")
            print(f"Texto: {q.get('question')}")
            print(f"Opcoes: {q.get('options')}")
            print(f"Correta: {q.get('correct')}")
        
        # Verificar se e fallback
        if len(questions) == 1 and "tema principal" in questions[0].get('question', '').lower():
            print("\n[ALERTA] Parece ser FALLBACK! IA nao esta funcionando!")
        else:
            print("\n[OK] IA parece estar gerando perguntas reais!")
    else:
        print(f"[ERRO] {quiz_data.get('error')}")

    # Gerar Resumo
    print("\n" + "=" * 60)
    print("5. Gerando Resumo via IA...")
    summary_resp = requests.post(f"{BASE_URL}/transcription/sessions/{session_id}/generate-summary",
        headers=headers
    )
    summary_data = summary_resp.json()
    
    if summary_data.get('success'):
        ai_content = summary_data.get('activity', {}).get('ai_generated_content', '')
        print(f"\nResumo gerado:")
        print(ai_content[:500])
        
        # Verificar se e fallback
        if "Resumo:" in ai_content and len(ai_content) < 200:
            print("\n[ALERTA] Parece ser FALLBACK! IA nao esta funcionando!")
        else:
            print("\n[OK] IA parece estar gerando resumo real!")
    else:
        print(f"[ERRO] {summary_data.get('error')}")

    # Limpar
    print("\n6. Encerrando...")
    requests.put(f"{BASE_URL}/transcription/sessions/{session_id}/end", headers=headers)
    print("   [OK] Sessao encerrada")

    print("\n" + "=" * 60)
    print("TESTE CONCLUIDO!")
    print("=" * 60)


if __name__ == "__main__":
    test_ai_quiz()
