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
            model_name='gemini-2.5-flash-lite',
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


def generate_quiz(text: str, subject_name: str = "Aula", num_questions: int = 20) -> str:
    """
    Gera um quiz baseado no texto transcrito
    
    Args:
        text: Texto transcrito para gerar quiz
        subject_name: Nome da disciplina/assunto (opcional)
        num_questions: Número de questões (1-20)
    
    Returns:
        Quiz formatado gerado pela IA ou mensagem de erro
    """
    if not GEMINI_API_KEY:
        return "Erro: GEMINI_API_KEY não configurada."
    
    try:
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash-lite',
            system_instruction=f"""Você é um assistente educacional especializado em criar quizzes sobre conteúdo de aulas.

REGRA CRÍTICA: O texto abaixo é uma TRANSCRIÇÃO de uma aula. Você deve criar perguntas sobre o CONTEÚDO EDUCACIONAL que está sendo ENSINADO na aula, NÃO sobre o processo de transcrição em si.

EXEMPLOS DO QUE FAZER:
✅ Se a transcrição diz "A fotossíntese é o processo...", pergunte: "O que é fotossíntese?"
✅ Se a transcrição diz "Vamos falar sobre a Segunda Guerra Mundial...", pergunte sobre eventos da guerra
✅ Se a transcrição diz "O teorema de Pitágoras afirma que...", pergunte sobre o teorema

EXEMPLOS DO QUE NÃO FAZER:
❌ NÃO pergunte "O que é transcrição?"
❌ NÃO pergunte "Qual a função de uma transcrição?"
❌ NÃO pergunte sobre o processo de gravar ou transcrever aulas
❌ NÃO use conhecimento externo - use APENAS o que foi mencionado na transcrição

Cada questão deve:
- Ser baseada no CONTEÚDO EDUCACIONAL mencionado na transcrição
- Ter 4 alternativas (A, B, C, D)
- Ter apenas uma resposta correta
- Ser clara e objetiva
- Testar compreensão do ASSUNTO da aula, não do processo de transcrição

Formate as questões estritamente como um JSON válido, sem markdown ou code blocks:

{{
    "questions": [
        {{
            "question": "Pergunta sobre o conteúdo da aula...",
            "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
            "correct": 0
        }}
    ]
}}

Responda apenas com o JSON cru."""
        )
        
        prompt = f"""Abaixo está a TRANSCRIÇÃO de uma aula de {subject_name}.

Crie {num_questions} questões de múltipla escolha sobre o CONTEÚDO EDUCACIONAL que está sendo ENSINADO nesta aula.

IMPORTANTE:
- Crie perguntas sobre o ASSUNTO da aula (ex: matemática, história, ciências)
- NÃO crie perguntas sobre "transcrição", "gravação" ou o processo de capturar a aula
- Use APENAS informações mencionadas no texto abaixo
- Se o texto mencionar conceitos, crie perguntas sobre esses conceitos

TRANSCRIÇÃO DA AULA:
{text}

Retorne apenas o JSON com as questões sobre o conteúdo educacional:"""
        
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



def _prepare_gemini_chat(teacher_id: int, subject_id: int):
    """Prepara a sessão e o objeto de chat do Gemini"""
    if not GEMINI_API_KEY:
        raise Exception("API Key não configurada")
        
    session = create_or_get_session(teacher_id, subject_id)
    
    # Buscar contexto de arquivos
    from app.models.ai_session import AIContextFile, AIMessage
    context_files = AIContextFile.query.filter_by(subject_id=subject_id).all()
    
    system_context = ""
    if context_files:
        system_context = "Você tem acesso aos seguintes documentos para responder:\n\n"
        for file in context_files:
            system_context += f"--- DOCUMENTO: {file.filename} ---\n{file.content}\n----------------\n\n"
        system_context += """
ATENÇÃO - REGRA CRÍTICA:
1. Você deve basear sua resposta EXCLUSIVAMENTE nos textos delimitados acima como 'DOCUMENTO'.
2. O histórico de conversa serve apenas para manter o contexto do diálogo (perguntas anteriores/resoluções).
3. Se o usuário perguntar sobre um arquivo que NÃO está listado acima (mesmo que tenha sido mencionado no histórico anterior), você DEVE responder: 'Este arquivo não está mais no contexto atual. Por favor, faça o upload dele novamente.'
4. NÃO invente informações e NÃO use conhecimento prévio externo se o documento não contiver a resposta.
"""

    # Recuperar histórico
    history = AIMessage.query.filter_by(session_id=session.id)\
        .order_by(AIMessage.created_at.desc())\
        .limit(20)\
        .all()
    history.reverse()
    
    chat_history = []
    for msg in history:
        role = "user" if msg.role == "user" else "model"
        chat_history.append({"role": role, "parts": [msg.content]})
        
    sys_instruction = """Você é um assistente educacional útil, direto e organizado.
Responda de forma clara, legível e visualmente limpa.
IMPORTANTE: NÃO USE NENHUMA FORMATAÇÃO MARKDOWN.
- NÃO use negrito (** ou __).
- NÃO use itálico (* ou _).
- NÃO use headers (#).
- NÃO use listas com marcadores ou números (- ou 1.).
- Escreva em texto corrido e simples.
- Para separar tópicos ou ideias, use apenas parágrafos com linha em branco entre eles.
- Se precisar listar, coloque cada item em um parágrafo novo sem marcadores visuais(somente nesse você pode usar marcadores 1, 2, 3...).

Se tiver acesso a documentos abaixo, use-os como fonte principal."""
    if system_context:
        sys_instruction += "\n\n" + system_context

    model = genai.GenerativeModel(
        model_name='gemini-2.5-flash-lite',
        system_instruction=sys_instruction
    )
    chat = model.start_chat(history=chat_history)
    
    return session, chat, context_files


def chat_with_gemini(teacher_id: int, subject_id: int, message: str) -> str:
    """Processa mensagem no chat e retorna resposta completa"""
    try:
        from app.models.ai_session import AIMessage
        session, chat, context_files = _prepare_gemini_chat(teacher_id, subject_id)
        
        # Salvar mensagem do usuário
        user_msg = AIMessage(session_id=session.id, role='user', content=message)
        db.session.add(user_msg)
        
        # Injetar lembrete de contexto
        files_list = [f.filename for f in context_files] if context_files else []
        if files_list:
            files_str = ", ".join(files_list)
            system_injection = f"\n\n[SISTEMA: Responda APENAS com base nos arquivos ativos: {files_str}. Ignore qualquer arquivo mencionado no histórico que não esteja nesta lista exata.]"
            message_to_send = message + system_injection
        else:
             system_injection = "\n\n[SISTEMA: NENHUM arquivo anexado atualmente. Se o usuário perguntar sobre documentos antigos, informe que eles não estão mais disponíveis.]"
             message_to_send = message + system_injection

        response = chat.send_message(message_to_send)
        response_text = response.text
        
        # Salvar resposta
        ai_msg = AIMessage(session_id=session.id, role='assistant', content=response_text)
        db.session.add(ai_msg)
        db.session.commit()
        
        return response_text
    except Exception as e:
        return f"Erro no chat: {str(e)}"


def chat_stream(teacher_id: int, subject_id: int, message: str):
    """Gera resposta em stream"""
    try:
        from app.models.ai_session import AIMessage
        session, chat, context_files = _prepare_gemini_chat(teacher_id, subject_id)
        
        # Salvar mensagem do usuário
        user_msg = AIMessage(session_id=session.id, role='user', content=message)
        db.session.add(user_msg)
        db.session.commit() # Commit user msg before streaming
        
        # Injetar lembrete de contexto
        files_list = [f.filename for f in context_files] if context_files else []
        if files_list:
            files_str = ", ".join(files_list)
            system_injection = f"\n\n[SISTEMA: Responda APENAS com base nos arquivos ativos: {files_str}. Ignore qualquer arquivo mencionado no histórico que não esteja nesta lista exata.]"
            message_to_send = message + system_injection
        else:
             system_injection = "\n\n[SISTEMA: NENHUM arquivo anexado atualmente. Se o usuário perguntar sobre documentos antigos, informe que eles não estão mais disponíveis.]"
             message_to_send = message + system_injection

        response = chat.send_message(message_to_send, stream=True)
        accumulated_text = ""
        
        for chunk in response:
            if chunk.text:
                yield chunk.text
                accumulated_text += chunk.text
        
        # Salvar resposta completa no final
        ai_msg = AIMessage(session_id=session.id, role='assistant', content=accumulated_text)
        db.session.add(ai_msg)
        db.session.commit()
            
    except Exception as e:
        yield f"Erro no streaming: {str(e)}"


def generate_study_questions(text: str) -> list[str]:
    """
    Gera 3 sugestões de perguntas baseadas no texto fornecido.
    
    Args:
        text: Texto extraído do arquivo.
    
    Returns:
        Lista de strings contendo as perguntas.
    """
    if not GEMINI_API_KEY:
        return []

    try:
        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        
        prompt = f"""Baseado no texto abaixo, gere 3 perguntas curtas e instigantes que um estudante poderia fazer para entender melhor o conteúdo.
        Retorne APENAS as perguntas separadas por quebra de linha. Nenhuma numeração ou texto adicional.
        
        Texto:
        {text[:10000]} # Limitar contexto para garantir rapidez
        
        Perguntas:"""
        
        response = model.generate_content(prompt)
        questions = [q.strip() for q in response.text.strip().split('\n') if q.strip()]
        return questions[:3] # Garantir apenas 3
    except Exception as e:
        print(f"Erro ao gerar sugestões: {e}")
        return []
