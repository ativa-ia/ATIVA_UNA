"""
Service para integração com OpenAI (Substituindo Gemini)
Sistema de Transcrição - Geração de Resumos e Quizzes
"""
import os
from dotenv import load_dotenv
import openai
from app import db
from app.models.ai_session import AISession, AIMessage
from datetime import datetime
import json

# Carregar .env
load_dotenv()

# Configurar API key
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
client = None

if OPENAI_API_KEY:
    client = openai.OpenAI(api_key=OPENAI_API_KEY)

MODEL_NAME = "gpt-4o-mini" # Modelo rápido e eficiente

def generate_content_with_prompt(system_instruction: str, prompt: str, json_mode: bool = False) -> str:
    """Gera conteúdo genérico com prompts personalizados via OpenAI"""
    if not client:
        return "Erro: OPENAI_API_KEY não configurada."
        
    try:
        kwargs = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7
        }
        
        if json_mode:
            kwargs["response_format"] = { "type": "json_object" }
            
        response = client.chat.completions.create(**kwargs)
        return response.choices[0].message.content
    except Exception as e:
        return f"Erro na geração AI: {str(e)}"


def generate_summary(text: str, subject_name: str = "Aula") -> str:
    """
    Gera um resumo do texto transcrito usando OpenAI
    """
    if not client:
        return "Erro: OPENAI_API_KEY não configurada."
    
    try:
        # Lógica Adaptativa baseada no tamanho do texto
        word_count = len(text.split())
        is_long_text = word_count > 300
        
        system_instruction = """Você é um assistente educacional especializado em criar resumos.
Sua tarefa é criar um resumo claro, objetivo e bem estruturado do conteúdo fornecido.
O resumo deve:
- Destacar os pontos principais
- Ser organizado em tópicos usando apenas texto simples
- Usar linguagem clara e didática
- Ter entre 200-400 palavras
- NÃO usar markdown, asteriscos, hashtags ou qualquer formatação especial
- Usar apenas texto puro com quebras de linha para separar parágrafos
Responda sempre em português brasileiro."""

        if is_long_text:
            prompt_instruction = f"""O texto fornecido é uma transcrição longa de uma aula de {subject_name}.
Sua tarefa é criar um RESUMO DETALHADO EM TÓPICOS.
Como a aula foi longa, você deve:
1. Identificar os tópicos mais interessantes e relevantes discutidos.
2. Para cada tópico, escreva um parágrafo detalhado explicando o conceito.
3. Use marcadores (•) para separar os tópicos.
4. Mantenha um tom educativo e engajador.
5. Capture a essência e os detalhes importantes da fala do professor.
Formato esperado:
• Tópico 1: Explicação detalhada...
• Tópico 2: Explicação detalhada..."""
        else:
            prompt_instruction = f"""O texto fornecido é uma transcrição curta de uma aula de {subject_name}.
Sua tarefa é criar um RESUMO OBJETIVO e DIRETO.
Como o texto é curto, você deve:
1. Sintetizar a ideia central em poucos parágrafos.
2. Ser conciso e ir direto ao ponto.
3. Não use tópicos, prefira texto corrido (parágrafos).
4. Resuma o que foi dito de forma clara."""

        prompt = f"""{prompt_instruction}

Texto da Transcrição:
{text}

Resumo:"""
        
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        
        return response.choices[0].message.content
    
    except Exception as e:
        return f"Erro ao gerar resumo: {str(e)}"


def generate_quiz(text: str, subject_name: str = "Aula", num_questions: int = 20) -> str:
    """
    Gera um quiz baseado no texto transcrito usando OpenAI
    """
    if not client:
        return "Erro: OPENAI_API_KEY não configurada."
    
    try:
        system_instruction = """Você é um assistente educacional especializado em criar quizzes sobre conteúdo de aulas.

REGRA CRÍTICA: O texto abaixo é uma TRANSCRIÇÃO de uma aula. Você deve criar perguntas sobre o CONTEÚDO EDUCACIONAL que está sendo ENSINADO na aula, NÃO sobre o processo de transcrição em si.

Cada questão deve:
- Ser baseada no CONTEÚDO EDUCACIONAL mencionado na transcrição
- Ter 4 alternativas (A, B, C, D)
- Ter apenas uma resposta correta
- Ser clara e objetiva
- Testar compreensão do ASSUNTO da aula, não do processo de transcrição

Formato de Saída Obrigatório (JSON):
{
    "questions": [
        {
            "question": "Enunciado da pergunta...",
            "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
            "correct": 0  // Índice da resposta correta (0-3)
        }
    ]
}"""

        prompt = f"""Abaixo está a TRANSCRIÇÃO de uma aula de {subject_name}.

Crie {num_questions} questões de múltipla escolha sobre o CONTEÚDO EDUCACIONAL que está sendo ENSINADO nesta aula.

IMPORTANTE:
- Crie perguntas sobre o ASSUNTO da aula (ex: matemática, história, ciências)
- NÃO crie perguntas sobre "transcrição", "gravação" ou o processo de capturar a aula
- Use APENAS informações mencionadas no texto abaixo
- Se o texto mencionar conceitos, crie perguntas sobre esses conceitos

TRANSCRIÇÃO DA AULA:
{text}

Retorne apenas o JSON com as questões sobre o conteúdo educacional."""

        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" },
            temperature=0.5
        )
        
        return response.choices[0].message.content
    
    except Exception as e:
        return f"Erro ao gerar quiz: {str(e)}"


def format_to_quiz_json(text: str) -> str:
    """
    Formata um texto que JÁ É um quiz para JSON, sem alterar o conteúdo.
    """
    if not client:
        return "Erro: OPENAI_API_KEY não configurada."
    
    try:
        system_instruction = """Você é um formatador de dados estrito.
Sua ÚNICA tarefa é converter o texto de entrada (que contem questões de quiz) para o formato JSON especificado.
REGRAS CRÍTICAS DE FIDELIDADE:
1. NÃO MUDE O CONTEXTO DAS PERGUNTAS.
2. NÃO INVENTE NOVAS PERGUNTAS.
3. USE EXATAMENTE AS MESMAS PERGUNTAS E OPÇÕES FORNECIDAS NO TEXTO.
4. Se o texto não tiver opções claras, você pode inferir opções plausíveis baseadas no contexto, mas MANTENHA A PERGUNTA ORIGINAL.
5. Se a resposta correta não estiver indicada, marque a opção 0 (A) como correta provisoriamente.

Formato de Saída (JSON puro):
{
    "questions": [
        {
            "question": "Texto exato da pergunta original...",
            "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
            "correct": 0
        }
    ]
}"""
        
        prompt = f"""Converta o seguinte quiz (texto) para JSON, mantendo o conteúdo original:

{text}

JSON:"""
        
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" },
            temperature=0.1
        )
        
        return response.choices[0].message.content
    
    except Exception as e:
        return f"Erro ao formatar quiz: {str(e)}"


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


def _prepare_ai_context(teacher_id: int, subject_id: int):
    """Prepara a sessão e o contexto para o chat"""
    if not OPENAI_API_KEY:
        raise Exception("API Key não configurada")
        
    session = create_or_get_session(teacher_id, subject_id)
    
    # Buscar contexto de arquivos
    from app.models.ai_session import AIContextFile, AIMessage
    context_files = AIContextFile.query.filter_by(session_id=session.id).all()
    
    system_initial_instruction = """Você é um assistente educacional útil, direto e organizado.
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

    system_context = ""
    if context_files:
        system_context = "\n\nVocê tem acesso aos seguintes documentos para responder:\n\n"
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
    history_msgs = AIMessage.query.filter_by(session_id=session.id)\
        .order_by(AIMessage.created_at.desc())\
        .limit(20)\
        .all()
    history_msgs.reverse()
    
    messages = [{"role": "system", "content": system_initial_instruction + system_context}]
    
    for msg in history_msgs:
        role = "user" if msg.role == "user" else "assistant"
        messages.append({"role": role, "content": msg.content})
        
    return session, messages, context_files


def chat_with_ai(teacher_id: int, subject_id: int, message: str) -> str:
    """Processa mensagem no chat e retorna resposta completa usando OpenAI"""
    try:
        from app.models.ai_session import AIMessage
        session, messages, context_files = _prepare_ai_context(teacher_id, subject_id)
        
        # Salvar mensagem do usuário
        user_msg = AIMessage(session_id=session.id, role='user', content=message)
        db.session.add(user_msg)
        
        # Injetar lembrete de contexto na última mensagem user
        files_list = [f.filename for f in context_files] if context_files else []
        if files_list:
            files_str = ", ".join(files_list)
            system_injection = f"\n\n[SISTEMA: Responda APENAS com base nos arquivos ativos: {files_str}. Ignore qualquer arquivo mencionado no histórico que não esteja nesta lista exata.]"
            message_to_send = message + system_injection
        else:
             system_injection = "\n\n[SISTEMA: NENHUM arquivo anexado atualmente. Se o usuário perguntar sobre documentos antigos, informe que eles não estão mais disponíveis.]"
             message_to_send = message + system_injection

        # Append user message to history provided to AI
        messages.append({"role": "user", "content": message_to_send})
        
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            temperature=0.7
        )
        response_text = response.choices[0].message.content
        
        # Salvar resposta
        ai_msg = AIMessage(session_id=session.id, role='assistant', content=response_text)
        db.session.add(ai_msg)
        db.session.commit()
        
        return response_text
    except Exception as e:
        return f"Erro no chat: {str(e)}"

# Alias for compatibility if needed, but better updated in routes
chat_with_gemini = chat_with_ai

def chat_stream(teacher_id: int, subject_id: int, message: str):
    """Gera resposta em stream usando OpenAI"""
    try:
        from app.models.ai_session import AIMessage
        session, messages, context_files = _prepare_ai_context(teacher_id, subject_id)
        
        # Salvar mensagem do usuário
        user_msg = AIMessage(session_id=session.id, role='user', content=message)
        db.session.add(user_msg)
        db.session.commit() # Commit user msg before streaming
        
        # Injetar lembrete
        files_list = [f.filename for f in context_files] if context_files else []
        if files_list:
            files_str = ", ".join(files_list)
            system_injection = f"\n\n[SISTEMA: Responda APENAS com base nos arquivos ativos: {files_str}. Ignore qualquer arquivo mencionado no histórico que não esteja nesta lista exata.]"
            message_to_send = message + system_injection
        else:
             system_injection = "\n\n[SISTEMA: NENHUM arquivo anexado atualmente. Se o usuário perguntar sobre documentos antigos, informe que eles não estão mais disponíveis.]"
             message_to_send = message + system_injection

        messages.append({"role": "user", "content": message_to_send})

        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            temperature=0.7,
            stream=True
        )
        
        accumulated_text = ""
        
        for chunk in response:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                yield content
                accumulated_text += content
        
        # Salvar resposta completa no final
        ai_msg = AIMessage(session_id=session.id, role='assistant', content=accumulated_text)
        db.session.add(ai_msg)
        db.session.commit()
            
    except Exception as e:
        yield f"Erro no streaming: {str(e)}"


def generate_study_questions(text: str) -> list[str]:
    """
    Gera 3 sugestões de perguntas baseadas no texto fornecido.
    """
    if not client:
        return []

    try:
        prompt = f"""Baseado no texto abaixo, gere 3 perguntas curtas e instigantes que um estudante poderia fazer para entender melhor o conteúdo.
Retorne APENAS as perguntas separadas por quebra de linha. Nenhuma numeração ou texto adicional.

Texto:
{text[:10000]} # Limitar contexto

Perguntas:"""
        
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        questions = [q.strip() for q in response.choices[0].message.content.strip().split('\n') if q.strip()]
        return questions[:3]
    except Exception as e:
        print(f"Erro ao gerar sugestões: {e}")
        return []
