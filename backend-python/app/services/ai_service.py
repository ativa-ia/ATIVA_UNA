"""
Service para integração com Google Gemini AI
Sistema de Transcrição - Geração de Resumos e Quizzes
"""
import os
from dotenv import load_dotenv
import google.generativeai as genai
from app import db
from app.models.ai_session import AISession, AIMessage
from datetime import datetime

# Carregar .env
load_dotenv()

# Configurar API key
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def generate_summary(text: str, subject_name: str = "Aula") -> str:
    """
    Gera um resumo do texto transcrito
    
    Args:
        text: Texto transcrito para resumir
        subject_name: Nome da disciplina/assunto (opcional)
    
    Returns:
        Resumo gerado pela IA ou mensagem de erro
    """
    if not GEMINI_API_KEY:
        return "Erro: GEMINI_API_KEY não configurada."
    
    try:
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=f"""Você é um assistente educacional especializado em criar resumos.
            
Sua tarefa é criar um resumo claro, objetivo e bem estruturado do conteúdo fornecido.
Se o texto for curto ou apenas um título, use seu conhecimento para explicar o TEMA principal.
O resumo deve:
- Destacar os pontos principais
- Ser organizado em tópicos usando apenas texto simples
- Usar linguagem clara e didática
- Ter entre 200-400 palavras
- NÃO usar markdown, asteriscos, hashtags ou qualquer formatação especial
- Usar apenas texto puro com quebras de linha para separar parágrafos

Responda sempre em português brasileiro."""
        )
        
        prompt = f"""Crie um resumo do seguinte conteúdo de {subject_name}:

{text}

Resumo:"""
        
        response = model.generate_content(prompt)
        return response.text
    
    except Exception as e:
        return f"Erro ao gerar resumo: {str(e)}"


def generate_quiz(text: str, subject_name: str = "Aula", num_questions: int = 10) -> str:
    """
    Gera um quiz baseado no texto transcrito
    
    Args:
        text: Texto transcrito para gerar quiz
        subject_name: Nome da disciplina/assunto (opcional)
        num_questions: Número de questões (1-10)
    
    Returns:
        Quiz formatado gerado pela IA ou mensagem de erro
    """
    if not GEMINI_API_KEY:
        return "Erro: GEMINI_API_KEY não configurada."
    
    try:
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=f"""Você é um assistente educacional especializado em criar quizzes.
            
Sua tarefa é criar questões de múltipla escolha EXCLUSIVAMENTE baseadas no conteúdo transcrito fornecido.
IMPORTANTE: NÃO use conhecimento geral sobre o tema. Crie perguntas APENAS sobre o que foi mencionado no texto transcrito.
Se o texto for muito curto, crie questões simples e diretas sobre o conteúdo disponível.
- Ser baseada APENAS no conteúdo transcrito
- Ter 4 alternativas (A, B, C, D)
- Ter apenas uma resposta correta
- Ser clara e objetiva
- Testar compreensão do que foi efetivamente falado/transcrito

Formate as questões estritamente como um JSON válido, sem markdown ou code blocks, seguindo este esquema:

{{
    "questions": [
        {{
            "question": "Pergunta...",
            "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
            "correct": 0  // índice da correta (0-3)
        }}
    ]
}}

Responda apenas com o JSON cru."""
        )
        
        prompt = f"""Crie {num_questions} questões de múltipla escolha baseadas EXCLUSIVAMENTE no seguinte conteúdo transcrito.
NÃO adicione conhecimento geral sobre {subject_name}. Use APENAS o que está escrito abaixo.
Retorne apenas o JSON, sem formatação extra:

{text}"""
        
        response = model.generate_content(prompt)
        return response.text
    
    except Exception as e:
        return f"Erro ao gerar quiz: {str(e)}"


def create_or_get_session(teacher_id: int, subject_id: int) -> AISession:
    """Retorna ou cria uma sessão ativa para o professor na disciplina"""
    session = AISession.query.filter_by(
        teacher_id=teacher_id,
        subject_id=subject_id,
        status='active'
    ).first()
    
    if not session:
        session = AISession(
            teacher_id=teacher_id,
            subject_id=subject_id
        )
        db.session.add(session)
        db.session.commit()
    
    return session


def chat_with_gemini(teacher_id: int, subject_id: int, message: str) -> str:
    """Processa mensagem no chat e retorna resposta"""
    if not GEMINI_API_KEY:
        return "Erro: API Key não configurada"
        
    try:
        session = create_or_get_session(teacher_id, subject_id)
        
        # Salvar mensagem do usuário
        user_msg = AIMessage(
            session_id=session.id,
            role='user',
            content=message
        )
        db.session.add(user_msg)
        
        # Recupear histórico (limitado aos últimos 10 pares para contexto)
        history = AIMessage.query.filter_by(session_id=session.id)\
            .order_by(AIMessage.created_at.desc())\
            .limit(20)\
            .all()
        history.reverse()
        
        # Construir prompt com histórico
        chat_history = []
        for msg in history:
            role = "user" if msg.role == "user" else "model"
            chat_history.append({"role": role, "parts": [msg.content]})
            
        model = genai.GenerativeModel('gemini-2.5-flash')
        chat = model.start_chat(history=chat_history)
        
        response = chat.send_message(message)
        response_text = response.text
        
        # Salvar resposta
        ai_msg = AIMessage(
            session_id=session.id,
            role='assistant',
            content=response_text
        )
        db.session.add(ai_msg)
        db.session.commit()
        
        return response_text
        
    except Exception as e:
        return f"Erro no chat: {str(e)}"

def chat_stream(teacher_id: int, subject_id: int, message: str):
    """Gera resposta em stream"""
    # Implementação simplificada sem stream real por enquanto para garantir estabilidade
    response = chat_with_gemini(teacher_id, subject_id, message)
    yield response
