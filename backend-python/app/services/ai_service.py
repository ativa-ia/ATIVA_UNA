"""
Service para integração com Google Gemini AI
"""
import os
from dotenv import load_dotenv
# import google.generativeai as genai
from typing import List, Optional, Generator
from app import db
from app.models.ai_session import AISession, AIMessage
from app.models.subject import Subject
from app.models.user import User

# Carregar .env explicitamente
load_dotenv()

# Configurar API key
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
HAS_GEMINI = False

try:
    import google.generativeai as genai
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
    HAS_GEMINI = True
except ImportError as e:
    print(f"Aviso: Não foi possível importar google.generativeai: {e}")
    HAS_GEMINI = False


def get_system_prompt(teacher: User, subject: Subject) -> str:
    """Gera o prompt de sistema com contexto do professor e disciplina"""
    return f"""Você é um assistente de IA educacional para professores.

Professor: {teacher.name}
Disciplina: {subject.name}

Suas funções principais:
- Ajudar a preparar aulas e conteúdos
- Gerar quizzes e atividades
- Criar resumos de tópicos
- Sugerir planos de aula
- Responder dúvidas sobre o conteúdo da disciplina

Seja didático, claro e objetivo. Responda sempre em português brasileiro.
Quando o professor pedir para gerar um quiz, crie perguntas de múltipla escolha formatadas.
Quando pedir para enviar algo aos alunos, confirme o que será enviado."""


def create_or_get_session(teacher_id: int, subject_id: int) -> AISession:
    """Cria ou retorna sessão ativa existente"""
    # Buscar sessão ativa existente
    session = AISession.query.filter_by(
        teacher_id=teacher_id,
        subject_id=subject_id,
        status='active'
    ).first()

    if not session:
        session = AISession(
            teacher_id=teacher_id,
            subject_id=subject_id,
            status='active'
        )
        db.session.add(session)
        db.session.commit()

    return session


def get_session_history(session_id: int, limit: int = 10) -> List[dict]:
    """Retorna histórico de mensagens da sessão"""
    messages = AIMessage.query.filter_by(session_id=session_id)\
        .order_by(AIMessage.created_at.desc())\
        .limit(limit)\
        .all()
    
    # Reverter para ordem cronológica
    messages.reverse()
    
    return [{'role': m.role, 'parts': [m.content]} for m in messages]


def save_message(session_id: int, role: str, content: str) -> AIMessage:
    """Salva mensagem no banco de dados"""
    message = AIMessage(
        session_id=session_id,
        role=role,
        content=content
    )
    db.session.add(message)
    db.session.commit()
    return message


def chat_with_gemini(
    teacher_id: int,
    subject_id: int,
    message: str,
    stream: bool = False
) -> str:
    """
    Envia mensagem para o Gemini e retorna resposta
    """
    if not HAS_GEMINI:
        return "Erro: Biblioteca do Google Gemini não instalada no servidor. Contate o administrador."

    if not GEMINI_API_KEY:
        return "Erro: GEMINI_API_KEY não configurada. Configure a variável de ambiente."

    # Buscar professor e disciplina
    teacher = User.query.get(teacher_id)
    subject = Subject.query.get(subject_id)

    if not teacher or not subject:
        return "Erro: Professor ou disciplina não encontrados."

    # Criar ou obter sessão
    session = create_or_get_session(teacher_id, subject_id)

    # Salvar mensagem do usuário
    save_message(session.id, 'user', message)

    try:
        # Configurar modelo
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=get_system_prompt(teacher, subject)
        )

        # Obter histórico
        history = get_session_history(session.id, limit=10)

        # Criar chat com histórico
        chat = model.start_chat(history=history[:-1] if len(history) > 1 else [])

        # Gerar resposta
        response = chat.send_message(message)
        assistant_response = response.text

        # Salvar resposta
        save_message(session.id, 'model', assistant_response)

        return assistant_response

    except Exception as e:
        error_msg = f"Erro ao comunicar com Gemini: {str(e)}"
        return error_msg


def chat_stream(
    teacher_id: int,
    subject_id: int,
    message: str
) -> Generator[str, None, None]:
    """
    Versão streaming do chat
    """
    if not HAS_GEMINI:
        yield "Erro: Biblioteca do Google Gemini não instalada."
        return

    if not GEMINI_API_KEY:
        yield "Erro: GEMINI_API_KEY não configurada."
        return

    teacher = User.query.get(teacher_id)
    subject = Subject.query.get(subject_id)

    if not teacher or not subject:
        yield "Erro: Professor ou disciplina não encontrados."
        return

    session = create_or_get_session(teacher_id, subject_id)
    save_message(session.id, 'user', message)

    try:
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=get_system_prompt(teacher, subject)
        )

        history = get_session_history(session.id, limit=10)
        chat = model.start_chat(history=history[:-1] if len(history) > 1 else [])

        response = chat.send_message(message, stream=True)

        full_response = ""
        for chunk in response:
            if chunk.text:
                full_response += chunk.text
                yield chunk.text

        # Salvar resposta completa
        save_message(session.id, 'model', full_response)

    except Exception as e:
        yield f"Erro: {str(e)}"


def generate_quiz_from_text(text: str, num_questions: int = 5) -> dict:
    """
    Gera quiz de múltipla escolha baseado no texto da transcrição
    Retorna dict com formato:
    {
        "questions": [
            {"question": "...", "options": ["A", "B", "C", "D"], "correct": 0},
            ...
        ]
    }
    """
    print(f"[AI-QUIZ] Iniciando geração de quiz...")
    print(f"[AI-QUIZ] Comprimento do texto: {len(text)} caracteres")
    
    try:
        print(f"[AI-QUIZ] Chamando Gemini API...")
        model = genai.GenerativeModel(model_name='gemini-2.5-flash')
        
        prompt = f"""Com base no seguinte texto de aula, gere {num_questions} perguntas de múltipla escolha para testar a compreensão dos alunos.

TEXTO DA AULA:
{text}

REGRAS:
1. Cada pergunta deve ter 4 opções (A, B, C, D)
2. Apenas uma opção deve estar correta
3. As perguntas devem ser claras e objetivas
4. Responda APENAS com JSON válido, sem markdown

FORMATO DE RESPOSTA (JSON puro):
{{
    "questions": [
        {{"question": "Pergunta aqui?", "options": ["Opção A", "Opção B", "Opção C", "Opção D"], "correct": 0}},
        ...
    ]
}}

O campo "correct" é o índice (0-3) da opção correta."""

        response = model.generate_content(prompt)
        response_text = response.text.strip()
        print(f"[AI-QUIZ] Resposta bruta: {response_text[:200]}...")
        
        # Limpar possíveis marcadores de código
        if response_text.startswith('```'):
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
        
        import json
        quiz_data = json.loads(response_text)
        print(f"[AI-QUIZ] Quiz gerado com sucesso! {len(quiz_data.get('questions', []))} perguntas")
        return quiz_data
        
    except Exception as e:
        print(f"[AI-QUIZ] ERRO ao gerar quiz: {e}")
        import traceback
        traceback.print_exc()
        return {
            "questions": [
                {
                    "question": "Qual é o tema principal da aula?",
                    "options": ["Tema A", "Tema B", "Tema C", "Tema D"],
                    "correct": 0
                }
            ]
        }


def generate_summary_from_text(text: str) -> str:
    """
    Gera resumo estruturado baseado no texto da transcrição
    """
    try:
        model = genai.GenerativeModel(model_name='gemini-2.5-flash')
        
        prompt = f"""Crie um resumo estruturado e didático do seguinte texto de aula.

TEXTO DA AULA:
{text}

REGRAS:
1. O resumo deve ser claro e objetivo
2. Destaque os pontos principais
3. Use tópicos quando apropriado
4. Mantenha o resumo conciso (máximo 500 palavras)
5. Escreva em português brasileiro

FORMATO:
- Comece com uma visão geral
- Liste os conceitos principais
- Conclua com os pontos-chave para lembrar"""

        response = model.generate_content(prompt)
        return response.text.strip()
        
    except Exception as e:
        print(f"Erro ao gerar resumo: {e}")
        words = text.split()[:100]
        return f"Resumo automático: {' '.join(words)}..."

