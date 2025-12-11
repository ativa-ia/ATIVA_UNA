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


def generate_quiz_from_text(text: str, num_questions: int = 5, teacher: User = None, subject: Subject = None) -> dict:
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
        print(f"[AI-QUIZ] Chamando Gemini API (2.5-flash)...")
        
        sys_instruction = None
        if teacher and subject:
            sys_instruction = get_system_prompt(teacher, subject)
            sys_instruction += "\n\nTAREFA ESPECÍFICA: Gere um quiz técnico e desafiador baseado APENAS no texto fornecido."
        
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=sys_instruction
        )
        
        prompt = f"""Com base no texto da aula abaixo, crie um quiz com {num_questions} perguntas de múltipla escolha.

TEXTO DA AULA:
{text}

REGRAS OBRIGATÓRIAS:
1. Gere EXATAMENTE {num_questions} perguntas.
2. Cada pergunta deve ter 4 opções (strings) e 1 resposta correta (índice 0-3).
3. Use linguagem acadêmica adequada.
4. Responda APENAS com JSON válido. NÃO use markdown (```json). NÃO adicione texto extra.

FORMATO JSON ESPERADO:
{{
    "questions": [
        {{
            "question": "Enunciado da pergunta?",
            "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
            "correct": 0
        }}
    ]
}}"""

        response = model.generate_content(prompt)
        response_text = response.text.strip()
        print(f"[AI-QUIZ] Resposta bruta: {response_text[:200]}...")
        
        # Limpeza robusta de markdown
        if "```" in response_text:
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        import json
        try:
            quiz_data = json.loads(response_text)
        except json.JSONDecodeError:
            # Tentar limpar caracteres invisíveis ou vírgulas extras
            response_text = response_text.strip()
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
                    "question": "Não foi possível gerar o quiz automaticamente. Tente novamente.",
                    "options": ["Erro na IA", "Tente Repetir", "Verifique o Texto", "Erro de Conexão"],
                    "correct": 0
                }
            ]
        }


def generate_summary_from_text(text: str, teacher: User = None, subject: Subject = None) -> str:
    """
    Gera resumo estruturado baseado no texto da transcrição
    """
    try:
        sys_instruction = None
        if teacher and subject:
            sys_instruction = get_system_prompt(teacher, subject)
            sys_instruction += "\n\nTAREFA ESPECÍFICA: Crie um resumo executivo didático desta aula."

        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=sys_instruction
        )
        
        prompt = f"""Analise a transcrição da aula abaixo e crie um resumo estruturado.

TEXTO DA AULA:
{text}

DIRETRIZES:
1. Comece com "Nesta aula sobre [Tópico], abordamos..."
2. Use bullet points para conceitos principais.
3. Destaque definições importantes em negrito.
4. Finalize com sugestão de estudo prático.
5. Mantenha tom professoral e encorajador.
"""

        response = model.generate_content(prompt)
        return response.text.strip()
        
    except Exception as e:
        print(f"Erro ao gerar resumo: {e}")
        words = text.split()[:50]
        return f"Resumo indisponível no momento. Início do texto: {' '.join(words)}..."

