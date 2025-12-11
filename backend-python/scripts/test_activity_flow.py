# -*- coding: utf-8 -*-
"""
Script para testar o fluxo completo: Professor cria atividade -> Aluno recebe
"""
import requests
import json
import time

# Configuracao
BASE_URL = "https://ativa-ia-9rkb.vercel.app/api"

# Credenciais
PROFESSOR_EMAIL = "maria.silva@edu.br"
PROFESSOR_PASSWORD = "prof123"
ALUNO_EMAIL = "lucas.aluno@edu.br"  # Aluno do seed
ALUNO_PASSWORD = "aluno123"

SUBJECT_ID = 1  # Ajuste para a disciplina correta


def test_activity_flow():
    print("=" * 60)
    print("TESTE: Fluxo Professor -> Aluno")
    print("=" * 60)

    # ========== PARTE 1: PROFESSOR ==========
    print("\n[PROFESSOR] Fazendo login...")
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": PROFESSOR_EMAIL,
        "password": PROFESSOR_PASSWORD
    })
    login_data = login_resp.json()

    if not login_data.get('success'):
        print(f"   [ERRO] Login do professor falhou: {login_data}")
        return

    prof_token = login_data.get('token')
    print(f"   [OK] Professor logado: {login_data.get('user', {}).get('name')}")

    prof_headers = {
        "Authorization": f"Bearer {prof_token}",
        "Content-Type": "application/json"
    }

    # Criar sessao
    print("\n[PROFESSOR] Criando sessao de transcricao...")
    session_resp = requests.post(f"{BASE_URL}/transcription/sessions",
        json={"subject_id": SUBJECT_ID, "title": "Aula de Teste"},
        headers=prof_headers
    )
    session_data = session_resp.json()

    if not session_data.get('success'):
        print(f"   [ERRO] {session_data}")
        return

    session_id = session_data.get('session', {}).get('id')
    print(f"   [OK] Sessao criada: ID={session_id}")

    # Adicionar transcricao
    print("\n[PROFESSOR] Adicionando transcricao...")
    texto = "Hoje vamos estudar sobre matematica. Os numeros sao muito importantes para resolver problemas do dia a dia."
    update_resp = requests.put(f"{BASE_URL}/transcription/sessions/{session_id}",
        json={"full_transcript": texto},
        headers=prof_headers
    )
    print(f"   [OK] Transcricao salva: {update_resp.json().get('word_count')} palavras")

    # Criar pergunta aberta (mais simples que quiz)
    print("\n[PROFESSOR] Criando pergunta aberta...")
    activity_resp = requests.post(f"{BASE_URL}/transcription/sessions/{session_id}/activities",
        json={"activity_type": "open_question", "question": "doubts", "time_limit": 300},
        headers=prof_headers
    )
    activity_data = activity_resp.json()

    if not activity_data.get('success'):
        print(f"   [ERRO] {activity_data}")
        return

    activity_id = activity_data.get('activity', {}).get('id')
    print(f"   [OK] Atividade criada: ID={activity_id}")
    print(f"      Status: {activity_data.get('activity', {}).get('status')}")
    print(f"      Shared: {activity_data.get('activity', {}).get('shared_with_students')}")

    # Broadcast para alunos
    print("\n[PROFESSOR] Iniciando atividade (broadcast)...")
    broadcast_resp = requests.put(f"{BASE_URL}/transcription/activities/{activity_id}/broadcast",
        headers=prof_headers
    )
    broadcast_data = broadcast_resp.json()

    if not broadcast_data.get('success'):
        print(f"   [ERRO] {broadcast_data}")
        return

    print(f"   [OK] Broadcast OK!")
    print(f"      Status: {broadcast_data.get('activity', {}).get('status')}")
    print(f"      Shared: {broadcast_data.get('activity', {}).get('shared_with_students')}")
    print(f"      Alunos matriculados: {broadcast_data.get('enrolled_students')}")

    # ========== PARTE 2: ALUNO ==========
    print("\n" + "=" * 60)
    print("[ALUNO] Fazendo login...")
    aluno_login = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ALUNO_EMAIL,
        "password": ALUNO_PASSWORD
    })
    aluno_data = aluno_login.json()

    if not aluno_data.get('success'):
        print(f"   [ERRO] Login do aluno falhou: {aluno_data}")
        print("   Verifique se existe um aluno matriculado na disciplina.")
        return

    aluno_token = aluno_data.get('token')
    print(f"   [OK] Aluno logado: {aluno_data.get('user', {}).get('name')}")

    aluno_headers = {
        "Authorization": f"Bearer {aluno_token}",
        "Content-Type": "application/json"
    }

    # Verificar atividade ativa
    print("\n[ALUNO] Verificando atividade ativa na disciplina...")
    active_resp = requests.get(f"{BASE_URL}/transcription/subjects/{SUBJECT_ID}/active",
        headers=aluno_headers
    )
    active_data = active_resp.json()

    print(f"   Resposta: {json.dumps(active_data, indent=2, ensure_ascii=False)}")

    if active_data.get('active'):
        print("\n   [SUCESSO] O ALUNO PODE VER A ATIVIDADE!")
        print(f"   Tipo: {active_data.get('activity', {}).get('activity_type')}")
        print(f"   Titulo: {active_data.get('activity', {}).get('title')}")
    else:
        print("\n   [PROBLEMA] Aluno NAO esta vendo a atividade.")
        print("   Possivel causa: Aluno nao esta matriculado na disciplina.")

    # Limpar: encerrar atividade e sessao
    print("\n" + "=" * 60)
    print("[LIMPEZA] Encerrando atividade e sessao...")
    requests.put(f"{BASE_URL}/transcription/activities/{activity_id}/end", headers=prof_headers)
    requests.put(f"{BASE_URL}/transcription/sessions/{session_id}/end", headers=prof_headers)
    print("   [OK] Encerrado")

    print("\n" + "=" * 60)
    print("TESTE CONCLUIDO!")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_activity_flow()
    except requests.exceptions.ConnectionError:
        print("[ERRO] Nao foi possivel conectar ao servidor.")
    except Exception as e:
        print(f"[ERRO] {e}")
