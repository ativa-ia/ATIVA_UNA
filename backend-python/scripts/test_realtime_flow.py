import requests
import json
import time
import uuid

BASE_URL = "https://ativa-ia-9rkb.vercel.app/api"
# BASE_URL = "http://localhost:5000/api"

# Credenciais Únicas para cada teste
unique_id = uuid.uuid4().hex[:6]
PROFESSOR_EMAIL = f"prof_test_{unique_id}@edu.br"
PROFESSOR_SENHA = "password123"
ALUNO_EMAIL = f"aluno_test_{unique_id}@edu.br"
ALUNO_SENHA = "password123"

def register(name, email, password, role):
    print(f"   Registrando {name} ({email})...")
    resp = requests.post(f"{BASE_URL}/auth/register", json={
        "name": name, 
        "email": email, 
        "password": password,
        "role": role
    })
    return resp.json()

def login(email, senha):
    print(f"   Logando como {email}...")
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": senha})
    data = resp.json()
    return data.get('token'), data.get('user', {}).get('name')

def enroll_student(student_token, subject_id):
    headers = {"Authorization": f"Bearer {student_token}"}
    print(f"   Matriculando aluno na disciplina {subject_id}...")
    # Verificar rotas de matricula - assumindo enrollments/enroll ou similar
    # Se nao existir rota direta de matricula publica, tenta a rota de admin ou assume auto-matricula no registro
    # O auth_controller faz auto-matrícula no registro!
    pass

def test_flow():
    print("=" * 60)
    print(f"TESTE: Fluxo Real-Time (ID: {unique_id})")
    print("=" * 60)
    
    # 1. Registrar e Logar Professor
    print("\n1. Preparando Professor...")
    reg = register("Prof Teste", PROFESSOR_EMAIL, PROFESSOR_SENHA, "teacher")
    if not reg.get('success'):
        print(f"   [ERRO] Registro Prof: {reg}")
        return
        
    prof_token, prof_name = login(PROFESSOR_EMAIL, PROFESSOR_SENHA)
    if not prof_token:
        print("   [ERRO] Login Prof falhou")
        return
    print(f"   [OK] Professor logado: {prof_name}")

    # 2. Registrar e Logar Aluno
    print("\n2. Preparando Aluno...")
    reg_aluno = register("Aluno Teste", ALUNO_EMAIL, ALUNO_SENHA, "student")
    # Nota: O registro de aluno aciona auto-matrícula em todas as disciplinas existentes
    
    aluno_token, aluno_name = login(ALUNO_EMAIL, ALUNO_SENHA)
    if not aluno_token:
        print("   [ERRO] Login Aluno falhou")
        return
    print(f"   [OK] Aluno logado: {aluno_name}")
    
    # 3. Buscar Disciplina
    print("\n3. Buscando Disciplinas...")
    headers = {"Authorization": f"Bearer {prof_token}"}
    # Tentar listar subjects
    # A rota pode variar, vamos tentar /subjects
    resp = requests.get(f"{BASE_URL}/subjects", headers=headers)
    if resp.status_code != 200:
        # Tentar rota de student grades que lista subjects, ou rota de professor
        # Vamos tentar assumir ID 1 se falhar, mas o ideal é listar
        print(f"   Aviso: GET /subjects retornou {resp.status_code}. Tentando ID 1 cego.")
        subject_id = 1
    else:
        json_data = resp.json()
        if isinstance(json_data, list):
            subjects = json_data
        else:
            subjects = json_data.get('subjects', [])
            
        if not subjects:
             print("   [ERRO] Nenhuma disciplina encontrada no sistema. Rode o seed_database.py primeiro no backend.")
             return
        subject_id = subjects[0]['id']
        print(f"   [OK] Usando disciplina: {subjects[0]['name']} (ID: {subject_id})")

    # 4. Professor cria sessao
    print(f"\n4. Criando Sessão na disciplina {subject_id}...")
    resp = requests.post(f"{BASE_URL}/transcription/sessions", 
                        json={"title": f"Aula Teste {unique_id}", "subject_id": subject_id}, 
                        headers=headers)
    if resp.status_code != 201 and resp.status_code != 200:
        print(f"   [ERRO] Criar sessão falhou: {resp.text}")
        return
        
    session_data = resp.json()
    session_id = session_data.get('session', {}).get('id')
    print(f"   [OK] Sessão criada: ID={session_id}")
    
    # 5. Adicionar Transcrição
    print("\n5. Enviando Transcrição...")
    requests.put(f"{BASE_URL}/transcription/sessions/{session_id}", 
                json={"full_transcript": "O Python é uma linguagem incrível. Vamos fazer um quiz sobre variáveis e funções."}, 
                headers=headers)
                
    # 6. Gerar Quiz
    print("\n6. Gerando Quiz...")
    # Tentar gerar quiz com 3 perguntas
    resp = requests.post(f"{BASE_URL}/transcription/sessions/{session_id}/generate-quiz", 
                        json={"num_questions": 3}, 
                        headers=headers)
    quiz_data = resp.json()
    if not quiz_data.get('success'):
         print(f"   [ERRO] Gerar quiz falhou: {quiz_data}")
         return
         
    activity_id = quiz_data.get('activity', {}).get('id')
    print(f"   [OK] Quiz Gerado: Activity ID {activity_id}")
    
    # 7. Broadcast
    print("\n7. BROADCAST (O Momento da Verdade)...")
    resp = requests.post(f"{BASE_URL}/transcription/activities/{activity_id}/broadcast", headers=headers)
    print(f"   Status Broadcast: {resp.status_code}")
    print(f"   Response: {resp.text}")
    
    if resp.status_code != 200:
        print("   [FALHA] Broadcast falhou.")
        return

    # 8. Aluno verifica polling
    print("\n8. Aluno verificando polling...")
    aluno_headers = {"Authorization": f"Bearer {aluno_token}"}
    
    # Tenta 3 vezes com delay
    for i in range(3):
        print(f"   Tentativa {i+1}...")
        resp = requests.get(f"{BASE_URL}/transcription/subjects/{subject_id}/active", headers=aluno_headers)
        active_data = resp.json()
        
        if active_data.get('active'):
            print(f"   [SUCESSO] ATIVIDADE ENCONTRADA!")
            print(f"   Título: {active_data.get('activity', {}).get('title')}")
            print(f"   Tipo: {active_data.get('activity', {}).get('activity_type')}")
            break
        else:
            print("   Nada ainda...")
            time.sleep(1)
            
    if not active_data.get('active'):
        print("   [FALHA] Aluno não viu a atividade após broadcast.")
    else:
        print("\n   >>> PROVA DE CONCEITO: FUNCIONOU! <<<")

if __name__ == "__main__":
    test_flow()
