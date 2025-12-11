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

BASE_URL = "https://ativa-ia-9rkb.vercel.app/api"

# Credenciais
PROFESSOR_EMAIL = "maria.silva@edu.br"
PROFESSOR_SENHA = "password123"
ALUNO_EMAIL = "joao.souza@edu.br" # Usando um aluno do seed também
ALUNO_SENHA = "password123"

def register(name, email, password, role):
    resp = requests.post(f"{BASE_URL}/auth/register", json={
        "name": name, 
        "email": email, 
        "password": password,
        "role": role,
        "registration_code": "PROF123456" if role == 'teacher' else "ABC12345"
    })
    return resp.json()

def login(email, senha):
    print(f"   Tentando login com {email}...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": senha})
    data = resp.json()
    
    if not data.get('success'):
        # Tentar registrar se falhar login
        print(f"   Login falhou, tentando registrar...")
        role = 'teacher' if 'prof' in email else 'student'
        reg_data = register(f"Test User {role}", email, senha, role)
        if reg_data.get('success'):
            print(f"   [OK] Registrado com sucesso!")
            # Login novamente
            resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": senha})
            data = resp.json()
            
    return data.get('token'), data.get('user', {}).get('name')

def enroll_student(student_token, subject_id):
    headers = {"Authorization": f"Bearer {student_token}"}
    # Auto matricular
    requests.post(f"{BASE_URL}/enrollments/enroll", 
                 json={"subject_id": subject_id}, 
                 headers=headers)

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
    enroll_student(aluno_token, 1) # Matricular na disciplina 1
    
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
