"""
Rotas da API do Assistente Socrático
Aula Invertida - O aluno explica, o assistente desafia com perguntas
"""
from flask import Blueprint, request, jsonify
from app.middleware.auth_middleware import token_required
from app.services.ai_service import generate_content_with_prompt
from app import db
from app.models.socratic import SocraticSession
from datetime import datetime

socratic_bp = Blueprint('socratic', __name__)


REFINE_SYSTEM_PROMPT = """Você é um corretor de texto especializado em transcrições de fala (STT) em português brasileiro.
Seu trabalho é corrigir erros de transcrição mantendo o sentido original do que o aluno disse.

Regras:
- Corrija erros ortográficos e gramaticais causados pela transcrição automática
- Mantenha o tom informal/coloquial se o aluno usou
- Mantenha termos técnicos corretos (pode corrigir se estiverem claramente errados pela transcrição)
- NÃO mude o sentido do que foi dito
- NÃO adicione informações
- NÃO remova informações
- Retorne APENAS o texto corrigido, sem explicações ou comentários"""


SOCRATIC_SYSTEM_PROMPT = """Você é o Fred, um assistente educacional socrático extremamente perspicaz para alunos universitários.
Sua missão é OUVIR a explicação do aluno e DETECTAR lacunas, erros conceituais ou pontos superficiais, depois DESAFIAR o aluno com perguntas reflexivas.

## Seu Processo (siga sempre nesta ordem):
1. **INTERPRETAR**: Entenda exatamente o que o aluno quis dizer com a explicação dele
2. **ANALISAR**: Identifique:
   - Conceitos corretos (elogie brevemente)
   - Lacunas de conhecimento (o que ele NÃO mencionou mas deveria)
   - Misconceptions (conceitos errados ou imprecisos)
   - Pontos superficiais (mencionou mas não aprofundou)
3. **QUESTIONAR**: Formule perguntas que levem o aluno a preencher essas lacunas sozinho

## Regras Rígidas:
- NUNCA dê a resposta diretamente. Sempre faça perguntas
- Elogie os acertos de forma ESPECÍFICA ("Muito bem! Você identificou corretamente que...")
- Quando o aluno errar, NÃO corrija diretamente. Faça uma pergunta que o leve a perceber o erro
- Faça no máximo 2 perguntas por vez para não sobrecarregar
- Se o aluno demonstrar domínio, desafie com perguntas mais avançadas ou peça aplicações práticas
- Se o aluno parecer confuso, simplifique e volte aos conceitos básicos
- Use analogias quando possível

## Tom e Formato:
- Linguagem acessível e amigável (use "você", tom informal mas respeitoso)
- Seja encorajador e motivador
- Comece com um breve comentário sobre o que o aluno disse
- Faça suas perguntas socráticas
- Mantenha respostas concisas (máximo 3 parágrafos)
- Use emojis com moderação (🤔 💡 ✨)
- IMPORTANTE: Suas respostas serão convertidas em áudio (TTS), então evite formatação complexa como listas com bullets, markdown, etc. Use texto corrido e natural.

A disciplina atual é: {subject_name}"""


# ===================== SESSÕES =====================

@socratic_bp.route('/sessions', methods=['POST'])
@token_required
def create_session(current_user):
    """
    Cria uma nova sessão de conversa socrática.
    
    Body:
    {
        "subject_id": int,
        "title": str (opcional)
    }
    """
    data = request.get_json() or {}
    subject_id = data.get('subject_id')
    
    if not subject_id:
        return jsonify({'success': False, 'error': 'subject_id é obrigatório'}), 400
    
    title = data.get('title', 'Conversa Socrática')
    
    session = SocraticSession(
        user_id=current_user.id,
        subject_id=subject_id,
        title=title,
        messages_data=[],
        status='active'
    )
    db.session.add(session)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'session': session.to_dict()
    }), 201


@socratic_bp.route('/sessions', methods=['GET'])
@token_required
def get_sessions(current_user):
    """
    Lista as sessões do aluno, opcionalmente filtradas por disciplina.
    
    Query Params:
        subject_id: int (opcional)
    """
    subject_id = request.args.get('subject_id', type=int)
    
    query = SocraticSession.query.filter_by(user_id=current_user.id)
    
    if subject_id:
        query = query.filter_by(subject_id=subject_id)
    
    sessions = query.order_by(SocraticSession.updated_at.desc()).all()
    
    return jsonify({
        'success': True,
        'sessions': [s.to_dict(include_messages=False) for s in sessions]
    })


@socratic_bp.route('/sessions/<int:session_id>', methods=['GET'])
@token_required
def get_session(current_user, session_id):
    """
    Retorna uma sessão específica com todas as mensagens.
    """
    session = SocraticSession.query.filter_by(
        id=session_id,
        user_id=current_user.id
    ).first()
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    return jsonify({
        'success': True,
        'session': session.to_dict(include_messages=True)
    })


@socratic_bp.route('/sessions/<int:session_id>/finish', methods=['PUT'])
@token_required
def finish_session(current_user, session_id):
    """Encerra uma sessão socrática."""
    session = SocraticSession.query.filter_by(
        id=session_id,
        user_id=current_user.id
    ).first()
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    session.status = 'finished'
    db.session.commit()
    
    return jsonify({'success': True, 'session': session.to_dict(include_messages=False)})


# ===================== CHAT =====================

@socratic_bp.route('/sessions/<int:session_id>/chat', methods=['POST'])
@token_required
def socratic_chat(current_user, session_id):
    """
    Chat socrático dentro de uma sessão.
    Salva a mensagem do aluno, gera resposta da IA e salva tudo no JSON da sessão.
    
    Body:
    {
        "subject_name": str,
        "student_text": str  (mensagem atual do aluno, já refinada)
    }
    """
    session = SocraticSession.query.filter_by(
        id=session_id,
        user_id=current_user.id
    ).first()
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    data = request.get_json() or {}
    subject_name = data.get('subject_name', 'Geral')
    student_text = data.get('student_text', '').strip()
    
    if not student_text:
        return jsonify({'success': False, 'error': 'Texto do aluno não fornecido'}), 400
    
    # 1. Salvar mensagem do aluno no JSON
    session.add_message('user', student_text)
    
    # 2. Construir o system prompt com a disciplina
    system_prompt = SOCRATIC_SYSTEM_PROMPT.replace('{subject_name}', subject_name)
    
    # 3. Construir o prompt completo com histórico (últimas 20 mensagens)
    messages = session.messages_data if session.messages_data else []
    recent_messages = messages[-20:]
    
    conversation_context = ""
    if len(recent_messages) > 1:  # Mais do que só a mensagem atual
        conversation_context = "Histórico da conversa até agora:\n"
        for msg in recent_messages[:-1]:  # Excluir a última (que é a atual)
            role_label = "Aluno" if msg.get('role') == 'user' else "Fred"
            conversation_context += f"{role_label}: {msg.get('content', '')}\n"
        conversation_context += "\n---\n\n"
    
    prompt = f"{conversation_context}Nova mensagem do aluno:\n{student_text}"
    
    try:
        response = generate_content_with_prompt(
            system_instruction=system_prompt,
            prompt=prompt
        )
        
        if response.startswith('Erro'):
            return jsonify({
                'success': False,
                'error': 'Erro ao gerar resposta do assistente'
            }), 500
        
        assistant_text = response.strip()
        
        # 4. Salvar resposta da IA no JSON
        session.add_message('assistant', assistant_text)
        
        # 5. Atualizar título da sessão (primeiras 5 palavras, limpo)
        if len(messages) <= 2:
            words = student_text.split()
            if len(words) <= 5:
                session.title = ' '.join(words)
            else:
                session.title = ' '.join(words[:5]) + '...'
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'response': assistant_text,
            'session_id': session.id
        })
    except Exception as e:
        print(f"[SOCRATIC] Erro no chat: {e}")
        return jsonify({
            'success': False,
            'error': f'Erro interno: {str(e)}'
        }), 500


# ===================== REFINAMENTO =====================

@socratic_bp.route('/refine', methods=['POST'])
@token_required
def refine_transcription(current_user):
    """
    Pós-processamento do texto transcrito via STT.
    Corrige erros de transcrição mantendo o sentido original.
    
    Body:
    {
        "text": str  (texto bruto do STT)
    }
    """
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    
    if not text:
        return jsonify({'success': False, 'error': 'Texto não fornecido'}), 400
    
    if len(text) < 3:
        # Texto muito curto, retornar como está
        return jsonify({'success': True, 'refined_text': text})
    
    try:
        refined = generate_content_with_prompt(
            system_instruction=REFINE_SYSTEM_PROMPT,
            prompt=f"Corrija esta transcrição de fala:\n\n{text}"
        )
        
        # Se a IA retornou erro, usar texto original
        if refined.startswith('Erro'):
            return jsonify({'success': True, 'refined_text': text})
        
        return jsonify({
            'success': True,
            'refined_text': refined.strip()
        })
    except Exception as e:
        print(f"[SOCRATIC] Erro ao refinar texto: {e}")
        # Fallback: retornar texto original
        return jsonify({'success': True, 'refined_text': text})
