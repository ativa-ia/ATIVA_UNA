# -*- coding: utf-8 -*-
"""
Teste completo do fluxo Professor -> Aluno em tempo real
Verifica se:
1. Professor gera quiz
2. Professor inicia (broadcast)
3. Aluno consegue ver a atividade
"""
import requests
import json
import time

BASE_URL = "https://ativa-ia-backend.vercel.app/api"

# Credenciais
PROFESSOR_EMAIL = "maria@escola.com"
PROFESSOR_SENHA = "prof123"
ALUNO_EMAIL = "aluno1@escola.com"
ALUNO_SENHA = "aluno123"

def login(email, senha):
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": senha})
    data = resp.json()
    return data.get('token'), data.get('user', {}).get('name')

def test_flow():
    print("=" * 60)
    print("TESTE: Fluxo Professor -> Aluno em tempo real")
    print("=" * 60)
    
    # 1. Login Professor
    print("\n1. Login Professor...")
    prof_token, prof_name = login(PROFESSOR_EMAIL, PROFESSOR_SENHA)
    if not prof_token:
        print("   [ERRO] Falha no login do professor")
        return
    print(f"   [OK] Logado como: {prof_name}")
    
    # 2. Login Aluno
    print("\n2. Login Aluno...")
    aluno_token, aluno_name = login(ALUNO_EMAIL, ALUNO_SENHA)
    if not aluno_token:
        print("   [ERRO] Falha no login do aluno")
        return
    print(f"   [OK] Logado como: {aluno_name}")
    
    # 3. Professor cria sessão de transcrição
    print("\n3. Professor cria sessão...")
    headers = {"Authorization": f"Bearer {prof_token}"}
    resp = requests.post(f"{BASE_URL}/transcription/sessions", 
                        json={"title": "Aula Teste Real-time", "subject_id": 1}, 
                        headers=headers)
    session_data = resp.json()
    session_id = session_data.get('session', {}).get('id')
    print(f"   [OK] Sessão criada: ID={session_id}")
    
    # 4. Professor adiciona transcrição
    print("\n4. Professor adiciona transcrição...")
    texto = """
    Python é uma linguagem de programação de alto nível muito popular.
    Variáveis são usadas para armazenar valores. Exemplo: x = 10.
    Listas são usadas para guardar múltiplos valores: frutas = ['maçã', 'banana'].
    Funções ajudam a organizar o código e evitar repetição.
    O loop for percorre elementos: for item in lista.
    """
    resp = requests.put(f"{BASE_URL}/transcription/sessions/{session_id}", 
                       json={"full_transcript": texto}, 
                       headers=headers)
    print(f"   [OK] Transcrição salva")
    
    # 5. Professor gera quiz
    print("\n5. Professor gera quiz via IA...")
    resp = requests.post(f"{BASE_URL}/transcription/sessions/{session_id}/generate-quiz", 
                        json={"num_questions": 3}, 
                        headers=headers)
    quiz_data = resp.json()
    print(f"   Resposta: {json.dumps(quiz_data, indent=2, ensure_ascii=False)[:500]}")
    
    if not quiz_data.get('success'):
        print(f"   [ERRO] Falha ao gerar quiz: {quiz_data.get('error')}")
        return
    
    activity_id = quiz_data.get('activity', {}).get('id')
    questions = quiz_data.get('activity', {}).get('content', {}).get('questions', [])
    print(f"   [OK] Quiz gerado: {len(questions)} perguntas, Activity ID: {activity_id}")
    
    # Mostrar primeira pergunta
    if questions:
        q = questions[0]
        print(f"   Pergunta 1: {q.get('question', 'N/A')[:80]}...")
    
    # 6. Professor inicia (broadcast)
    print("\n6. Professor inicia atividade (broadcast)...")
    resp = requests.post(f"{BASE_URL}/transcription/activities/{activity_id}/broadcast", 
                        headers=headers)
    broadcast_data = resp.json()
    print(f"   Resposta: {json.dumps(broadcast_data, indent=2, ensure_ascii=False)}")
    
    if not broadcast_data.get('success'):
        print(f"   [ERRO] Falha no broadcast")
        return
    print(f"   [OK] Atividade enviada para {broadcast_data.get('enrolled_students', 0)} alunos")
    
    # 7. Aluno verifica atividade ativa
    print("\n7. Aluno verifica atividade ativa...")
    aluno_headers = {"Authorization": f"Bearer {aluno_token}"}
    resp = requests.get(f"{BASE_URL}/transcription/subjects/1/active", headers=aluno_headers)
    active_data = resp.json()
    print(f"   Resposta: {json.dumps(active_data, indent=2, ensure_ascii=False)}")
    
    if active_data.get('active'):
        print(f"   [OK] Aluno VÊ a atividade: {active_data.get('activity', {}).get('title')}")
    else:
        print(f"   [PROBLEMA] Aluno NÃO vê nenhuma atividade ativa!")
    
    # 8. Limpar - encerrar sessão
    print("\n8. Professor encerra sessão...")
    resp = requests.post(f"{BASE_URL}/transcription/sessions/{session_id}/end", headers=headers)
    print(f"   [OK] Sessão encerrada")
    
    print("\n" + "=" * 60)
    print("TESTE CONCLUÍDO!")
    print("=" * 60)

if __name__ == "__main__":
    test_flow()
