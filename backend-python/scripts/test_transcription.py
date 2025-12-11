# -*- coding: utf-8 -*-
"""
Script para testar os endpoints de Transcricao ao Vivo
"""
import requests
import json
import time

# Configuracao - Use localhost para testes locais, ou Vercel para producao
# BASE_URL = "http://localhost:3000/api"
BASE_URL = "https://ativa-ia-9rkb.vercel.app/api"

# Credenciais do professor (ajuste conforme seu banco)
LOGIN_EMAIL = "maria.silva@edu.br"
LOGIN_PASSWORD = "prof123"


def test_transcription():
    print("=" * 60)
    print("TESTE: Sistema de Transcricao ao Vivo")
    print("=" * 60)
    
    # 1. Login
    print("\n1. Fazendo login como professor...")
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": LOGIN_EMAIL,
        "password": LOGIN_PASSWORD
    })
    login_data = login_resp.json()
    
    if not login_data.get('success'):
        print(f"   [ERRO] Erro no login: {login_data}")
        return
    
    token = login_data.get('token')
    user = login_data.get('user', {})
    print(f"   [OK] Logado como: {user.get('name')} (ID: {user.get('id')})")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # 2. Criar sessao de transcricao
    print("\n2. Criando sessao de transcricao...")
    session_resp = requests.post(f"{BASE_URL}/transcription/sessions", 
        json={"subject_id": 1, "title": "Aula de Teste"},
        headers=headers
    )
    session_data = session_resp.json()
    
    if not session_data.get('success'):
        print(f"   [ERRO] {session_data}")
        return
    
    session = session_data.get('session', {})
    session_id = session.get('id')
    print(f"   [OK] Sessao criada: ID={session_id}, Status={session.get('status')}")
    
    # 3. Atualizar transcricao (simular auto-save)
    print("\n3. Atualizando transcricao...")
    texto = "Bom dia, turma! Hoje vamos falar sobre matematica. Os numeros sao fundamentais para ciencia. Vamos estudar fracoes e proporcoes."
    
    update_resp = requests.put(f"{BASE_URL}/transcription/sessions/{session_id}",
        json={"full_transcript": texto},
        headers=headers
    )
    update_data = update_resp.json()
    print(f"   [OK] Transcricao salva: {update_data.get('word_count')} palavras")
    
    # 4. Criar checkpoint
    print("\n4. Criando checkpoint (pausa)...")
    checkpoint_resp = requests.post(f"{BASE_URL}/transcription/sessions/{session_id}/checkpoint",
        json={"reason": "quiz"},
        headers=headers
    )
    checkpoint_data = checkpoint_resp.json()
    
    if checkpoint_data.get('success'):
        cp = checkpoint_data.get('checkpoint', {})
        print(f"   [OK] Checkpoint criado: ID={cp.get('id')}, {cp.get('word_count')} palavras")
    else:
        print(f"   [ERRO] {checkpoint_data}")
    
    # 5. Gerar Quiz via IA
    print("\n5. Gerando Quiz via IA (3 perguntas)...")
    quiz_resp = requests.post(f"{BASE_URL}/transcription/sessions/{session_id}/generate-quiz",
        json={"num_questions": 3},
        headers=headers
    )
    quiz_data = quiz_resp.json()
    
    if quiz_data.get('success'):
        activity = quiz_data.get('activity', {})
        questions = activity.get('content', {}).get('questions', [])
        print(f"   [OK] Quiz gerado: ID={activity.get('id')}, {len(questions)} perguntas")
        for i, q in enumerate(questions):
            q_text = q.get('question', '')[:50]
            print(f"      Q{i+1}: {q_text}...")
    else:
        print(f"   [ERRO] {quiz_data}")
        activity = {}
    
    # 6. Obter sessao completa
    print("\n6. Obtendo sessao completa...")
    get_resp = requests.get(f"{BASE_URL}/transcription/sessions/{session_id}",
        headers=headers
    )
    get_data = get_resp.json()
    
    if get_data.get('success'):
        s = get_data.get('session', {})
        print(f"   [OK] Sessao: {s.get('title')}")
        print(f"      Status: {s.get('status')}")
        print(f"      Palavras: {s.get('word_count')}")
        print(f"      Checkpoints: {len(s.get('checkpoints', []))}")
        print(f"      Atividades: {len(s.get('activities', []))}")
    
    # 7. Retomar sessao
    print("\n7. Retomando sessao...")
    resume_resp = requests.put(f"{BASE_URL}/transcription/sessions/{session_id}/resume",
        headers=headers
    )
    resume_data = resume_resp.json()
    
    if resume_data.get('success'):
        print(f"   [OK] Sessao retomada: status={resume_data.get('session', {}).get('status')}")
    
    # 8. Gerar Resumo via IA
    print("\n8. Gerando Resumo via IA...")
    summary_resp = requests.post(f"{BASE_URL}/transcription/sessions/{session_id}/generate-summary",
        headers=headers
    )
    summary_data = summary_resp.json()
    
    if summary_data.get('success'):
        act = summary_data.get('activity', {})
        summary_text = act.get('ai_generated_content', '')[:100]
        print(f"   [OK] Resumo gerado: {summary_text}...")
    else:
        print(f"   [ERRO] {summary_data}")
    
    # 9. Encerrar sessao
    print("\n9. Encerrando sessao...")
    end_resp = requests.put(f"{BASE_URL}/transcription/sessions/{session_id}/end",
        headers=headers
    )
    end_data = end_resp.json()
    
    if end_data.get('success'):
        print(f"   [OK] Sessao encerrada: status={end_data.get('session', {}).get('status')}")
    
    print("\n" + "=" * 60)
    print("TESTES CONCLUIDOS!")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_transcription()
    except requests.exceptions.ConnectionError:
        print("[ERRO] Nao foi possivel conectar ao servidor.")
        print("   Certifique-se de que o servidor Flask esta rodando em localhost:3000")
        print("   Execute: python run.py")
    except Exception as e:
        print(f"[ERRO] {e}")
