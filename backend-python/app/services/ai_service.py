"""
Service para integração com OpenAI (Substituindo Gemini)
Sistema de Transcrição - Geração de Resumos e Quizzes
"""
import os
from dotenv import load_dotenv
import openai
from app import db
from app.models.ai_session import AISession, AIMessage
from app.models.system_setting import SystemSetting
from datetime import datetime
import json

# Carregar .env
load_dotenv()

# Configuração Padrão (Fallback)
DEFAULT_MODEL = "gpt-4o-mini"

def get_ai_config():
    """Retorna a configuração atual de IA (Banco de Dados ou Env)"""
    # Tentar buscar do banco
    try:
        # Forçar SQLAlchemy a recarregar as configs em vez de usar cache de sessão antigo
        db.session.expire_all()
        
        api_key_setting = SystemSetting.query.get('openai_api_key')
        model_setting = SystemSetting.query.get('ai_model')
        
        api_key = api_key_setting.value if api_key_setting else os.getenv('OPENAI_API_KEY', '')
        model = model_setting.value if model_setting else DEFAULT_MODEL
        
        return api_key, model
    except Exception:
        # Fallback caso dê erro no banco (ex: durante migrações)
        return os.getenv('OPENAI_API_KEY', ''), DEFAULT_MODEL

def get_client():
    """Retorna uma instância do client OpenAI configurada"""
    api_key, _ = get_ai_config()
    if not api_key:
        return None
    return openai.OpenAI(api_key=api_key)

def generate_content_with_prompt(system_instruction: str, prompt: str, json_mode: bool = False) -> str:
    """Gera conteúdo genérico com prompts personalizados via OpenAI"""
    api_key, model_name = get_ai_config()
    client = get_client()
    
    if not client:
        return "Erro: OPENAI_API_KEY não configurada."
        
    try:
        kwargs = {
            "model": model_name,
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
    Gera material de reforço estruturado (JSON) a partir do texto transcrito usando OpenAI.
    Retorna uma string JSON com campos: topic, essential_concept, key_points,
    practical_example, common_mistakes, reflection.
    """
    api_key, model_name = get_ai_config()
    client = get_client()

    if not client:
        return "Erro: OPENAI_API_KEY não configurada."
    
    try:
        system_instruction = """Você é um assistente educacional especializado em criar material de reforço pedagógico rico e engajador.
Sua tarefa é analisar a transcrição de uma aula e produzir um material de estudo estruturado e detalhado.

Você DEVE retornar APENAS um JSON válido (sem markdown, sem blocos de código) com a seguinte estrutura:
{
    "topic": "Título claro e descritivo do assunto principal da aula",
    "essential_concept": "Uma explicação clara, detalhada e didática do conceito central (2-4 parágrafos). Use linguagem acessível e exemplos quando possível.",
    "key_points": ["Ponto-chave 1 com explicação breve", "Ponto-chave 2 com explicação breve", "Ponto-chave 3..."],
    "practical_example": "Um exemplo concreto do mundo real que ilustra o conceito. Seja criativo e relevante para a realidade do aluno.",
    "common_mistakes": ["Erro comum 1 que alunos cometem sobre esse tema", "Erro comum 2..."],
    "reflection": "Uma pergunta instigante e aberta que faça o aluno refletir sobre o conteúdo e conectar com o que já sabe."
}

REGRAS:
- key_points deve ter entre 3 e 6 itens.
- common_mistakes deve ter entre 2 e 4 itens.
- Todos os textos devem ser em português brasileiro.
- NÃO use markdown dentro dos valores (sem **, ##, etc).
- O essential_concept deve ser RICO e DETALHADO, não um resumo superficial.
- O practical_example deve ser concreto e fácil de visualizar.
- A reflection deve ser uma pergunta que estimule o pensamento crítico.
- Retorne SOMENTE o JSON, sem texto antes ou depois."""

        prompt = f"""Analise a transcrição da aula de "{subject_name}" abaixo e gere o material de reforço estruturado conforme as instruções.

TRANSCRIÇÃO DA AULA:
{text}

JSON:"""
        
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" },
            temperature=0.7
        )
        
        return response.choices[0].message.content
    
    except Exception as e:
        return f"Erro ao gerar resumo: {str(e)}"


def generate_interactive_audio_script(summary_text: str, subject_name: str = "Aula") -> str:
    """
    Transforma um resumo de aula em um roteiro conversacional otimizado para TTS.
    O texto gerado soa como um host de podcast ou professor particular,
    tornando o áudio mais envolvente e natural.
    """
    api_key, model_name = get_ai_config()
    client = get_client()

    if not client:
        return summary_text  # Fallback: retorna o texto original

    try:
        system_instruction = """Você é um roteirista de podcasts educacionais especializado em transformar textos acadêmicos em áudio envolvente.

Sua tarefa é reescrever o resumo de aula fornecido em um ROTEIRO DE ÁUDIO conversacional e didático.

REGRAS OBRIGATÓRIAS:
1. Escreva como se estivesse FALANDO diretamente com o aluno (use "você", "vamos", "olha só").
2. Comece com uma saudação breve e acolhedora, mencionando a disciplina. Exemplo: "E aí, tudo bem? Vamos revisar o conteúdo de hoje sobre..."
3. Use transições naturais entre os tópicos ("Agora, um ponto muito importante...", "E aqui vai uma dica...", "Presta atenção nessa parte...").
4. Inclua pausas naturais usando reticências (...) para dar ritmo.
5. Adicione ênfases e entusiasmo em pontos-chave ("Isso aqui é fundamental!", "Essa parte cai muito em prova!").
6. Quando houver exemplos, apresente-os de forma narrativa ("Imagina o seguinte cenário...").
7. Finalize com um encerramento motivacional breve ("Bons estudos!", "Até a próxima aula!" ou similar).
8. NÃO use formatação markdown (sem **, ##, -, bullets ou listas numeradas).
9. NÃO use emojis.
10. Escreva em texto CORRIDO, apenas com parágrafos separados por quebras de linha.
11. Mantenha TODA a informação do resumo original, não omita conteúdo.
12. O texto final deve ser em português brasileiro, com linguagem acessível e fluida.
13. O comprimento do roteiro deve ser similar ao do resumo original (não encurte significativamente).
14. EVITE repetições e frases genéricas como "vamos lá" mais de uma vez."""

        prompt = f"""Transforme o resumo abaixo da disciplina "{subject_name}" em um roteiro de áudio conversacional seguindo as instruções.

RESUMO ORIGINAL:
{summary_text}

ROTEIRO DE ÁUDIO:"""

        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            temperature=0.75
        )

        result = response.choices[0].message.content
        if result and len(result.strip()) > 50:
            return result.strip()
        return summary_text  # Fallback se a resposta for muito curta

    except Exception as e:
        print(f"[AI] Erro ao gerar roteiro de áudio: {e}")
        return summary_text  # Fallback: retorna o texto original


def generate_quiz(text: str, subject_name: str = "Aula", num_questions: int = 20) -> str:
    """
    Gera um quiz baseado no texto transcrito usando OpenAI
    """
    api_key, model_name = get_ai_config()
    client = get_client()

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
            model=model_name,
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
    api_key, model_name = get_ai_config()
    client = get_client()

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
            model=model_name,
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


def create_or_get_session(teacher_id: int, class_subject_id: int) -> AISession:
    """Retorna ou cria uma sessão ativa para o professor na oferta de disciplina"""
    session = AISession.query.filter_by(
        teacher_id=teacher_id,
        class_subject_id=class_subject_id,
        status='active'
    ).first()
    
    if not session:
        session = AISession(
            teacher_id=teacher_id,
            class_subject_id=class_subject_id
        )
        db.session.add(session)
        db.session.commit()
    
    return session


def _prepare_ai_context(teacher_id: int, class_subject_id: int):
    """Prepara a sessão e o contexto para o chat"""
    api_key, _ = get_ai_config()
    
    if not api_key:
        raise Exception("API Key não configurada")
        
    session = create_or_get_session(teacher_id, class_subject_id)
    
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


def chat_with_ai(teacher_id: int, class_subject_id: int, message: str) -> str:
    """Processa mensagem no chat e retorna resposta completa usando OpenAI"""
    api_key, model_name = get_ai_config()
    client = get_client()

    try:
        from app.models.ai_session import AIMessage
        session, messages, context_files = _prepare_ai_context(teacher_id, class_subject_id)
        
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
            model=model_name,
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

def chat_stream(teacher_id: int, class_subject_id: int, message: str):
    """Gera resposta em stream usando OpenAI"""
    api_key, model_name = get_ai_config()
    client = get_client()

    try:
        from app.models.ai_session import AIMessage
        session, messages, context_files = _prepare_ai_context(teacher_id, class_subject_id)
        
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
            model=model_name,
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
    api_key, model_name = get_ai_config()
    client = get_client()
    
    if not client:
        return []

    try:
        prompt = f"""Baseado no texto abaixo, gere 3 perguntas curtas e instigantes que um estudante poderia fazer para entender melhor o conteúdo.
Retorne APENAS as perguntas separadas por quebra de linha. Nenhuma numeração ou texto adicional.

Texto:
{text[:10000]} # Limitar contexto

Perguntas:"""
        
        response = client.chat.completions.create(
            model=model_name,
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
