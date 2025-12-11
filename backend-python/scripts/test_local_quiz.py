# -*- coding: utf-8 -*-
"""
Teste LOCAL direto da função generate_quiz_from_text
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Carregar .env
from dotenv import load_dotenv
load_dotenv()

print("=" * 60)
print("TESTE LOCAL: Funcao generate_quiz_from_text")
print("=" * 60)

# Verificar API Key
api_key = os.getenv('GEMINI_API_KEY', '')
print(f"\n1. GEMINI_API_KEY existe: {bool(api_key)}")
print(f"   Primeiros 10 chars: {api_key[:10]}...")

# Importar e testar
print("\n2. Importando ai_service...")
from app.services.ai_service import generate_quiz_from_text, HAS_GEMINI

print(f"   HAS_GEMINI: {HAS_GEMINI}")

# Testar a funcao
print("\n3. Testando generate_quiz_from_text...")
texto = """
Hoje vamos falar sobre Python, uma linguagem de programação muito popular.
Variáveis são usadas para armazenar valores. Por exemplo: x = 10.
Listas são usadas para guardar múltiplos valores: frutas = ['maçã', 'banana'].
Funções ajudam a organizar o código e evitar repetição.
"""

resultado = generate_quiz_from_text(texto, 3)

print("\n4. RESULTADO:")
import json
print(json.dumps(resultado, indent=2, ensure_ascii=False))

# Verificar se é fallback
questions = resultado.get('questions', [])
if len(questions) > 0:
    first_q = questions[0].get('question', '')
    if 'tema principal' in first_q.lower() or 'Tema A' in str(questions):
        print("\n[PROBLEMA] Parece ser FALLBACK!")
    else:
        print("\n[OK] IA gerou perguntas reais!")
