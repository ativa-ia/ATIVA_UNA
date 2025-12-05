"""
Rotas da API de IA
"""
from flask import Blueprint, request, jsonify, Response, stream_with_context
from app.middleware.auth_middleware import token_required
from app.services.ai_service import chat_with_gemini, chat_stream, create_or_get_session
from app.models.ai_session import AISession, AIMessage

ai_bp = Blueprint('ai', __name__)


@ai_bp.route('/chat', methods=['POST'])
@token_required
def chat(current_user):
    """
    Endpoint para chat com IA
    
    Body:
    {
        "message": "string",
        "subject_id": int,
        "stream": bool (optional)
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
    
    message = data.get('message')
    subject_id = data.get('subject_id')
    stream = data.get('stream', False)
    
    if not message:
        return jsonify({'success': False, 'error': 'Mensagem não fornecida'}), 400
    
    if not subject_id:
        return jsonify({'success': False, 'error': 'ID da disciplina não fornecido'}), 400
    
    if stream:
        # Resposta em streaming
        def generate():
            for chunk in chat_stream(current_user.id, subject_id, message):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        
        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            }
        )
    else:
        # Resposta normal
        response = chat_with_gemini(current_user.id, subject_id, message)
        return jsonify({
            'success': True,
            'response': response
        })


@ai_bp.route('/session/<int:subject_id>', methods=['GET'])
@token_required
def get_session(current_user, subject_id):
    """Retorna ou cria sessão ativa para a disciplina"""
    session = create_or_get_session(current_user.id, subject_id)
    return jsonify({
        'success': True,
        'session': session.to_dict()
    })


@ai_bp.route('/session/<int:session_id>/messages', methods=['GET'])
@token_required
def get_messages(current_user, session_id):
    """Retorna mensagens de uma sessão"""
    session = AISession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    messages = AIMessage.query.filter_by(session_id=session_id)\
        .order_by(AIMessage.created_at.asc())\
        .all()
    
    return jsonify({
        'success': True,
        'messages': [m.to_dict() for m in messages]
    })


@ai_bp.route('/session/<int:session_id>/end', methods=['POST'])
@token_required
def end_session(current_user, session_id):
    """Encerra uma sessão de chat"""
    from datetime import datetime
    from app import db
    
    session = AISession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
    
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
    
    session.status = 'ended'
    session.ended_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Sessão encerrada'
    })


@ai_bp.route('/process-content', methods=['POST'])
@token_required
def process_content(current_user):
    """
    Processa conteúdo ditado e gera quiz, resumo ou perguntas
    
    Body:
    {
        "content": "string",      # Conteúdo ditado pelo professor
        "action": "string",       # 'quiz', 'summary', 'discussion'
        "subject_id": int
    }
    """
    import google.generativeai as genai
    import os
    import json
    
    data = request.get_json()
    
    if not data:
        return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
    
    content = data.get('content')
    action = data.get('action')
    subject_id = data.get('subject_id')
    
    if not content:
        return jsonify({'success': False, 'error': 'Conteúdo não fornecido'}), 400
    
    if action not in ['quiz', 'summary', 'discussion']:
        return jsonify({'success': False, 'error': 'Ação inválida'}), 400
    
    # Configurar Gemini
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    if not GEMINI_API_KEY:
        return jsonify({'success': False, 'error': 'GEMINI_API_KEY não configurada'}), 500
    
    genai.configure(api_key=GEMINI_API_KEY)
    
    prompts = {
        'quiz': f"""Você é um professor criando um quiz educacional.

Com base no seguinte conteúdo:
---
{content}
---

Gere EXATAMENTE 10 perguntas de múltipla escolha em formato JSON.
Cada pergunta deve ter 4 alternativas (A, B, C, D).

Responda APENAS com o JSON, sem texto adicional:
{{
  "questions": [
    {{
      "question": "Texto da pergunta?",
      "options": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
      "correct": 0
    }}
  ]
}}

IMPORTANTE: "correct" é o índice da resposta correta (0=A, 1=B, 2=C, 3=D)""",

        'summary': f"""Você é um professor criando material didático.

Com base no seguinte conteúdo:
---
{content}
---

Crie um resumo didático e bem estruturado com:
1. Título do tema
2. Pontos principais (em tópicos)
3. Conceitos-chave para memorizar
4. Conclusão

Seja claro e objetivo. Use linguagem acessível para estudantes.""",

        'discussion': f"""Você é um professor preparando uma discussão em sala.

Com base no seguinte conteúdo:
---
{content}
---

Gere EXATAMENTE 5 perguntas para discussão em grupo.
As perguntas devem estimular pensamento crítico e debate.

Responda em formato JSON:
{{
  "questions": [
    {{
      "question": "Pergunta para discussão?",
      "objective": "O que a pergunta busca desenvolver nos alunos"
    }}
  ]
}}"""
    }
    
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(prompts[action])
        result_text = response.text
        
        # Para quiz e discussion, tentar parsear como JSON
        if action in ['quiz', 'discussion']:
            # Limpar resposta de possíveis marcadores markdown
            clean_text = result_text.strip()
            if clean_text.startswith('```json'):
                clean_text = clean_text[7:]
            if clean_text.startswith('```'):
                clean_text = clean_text[3:]
            if clean_text.endswith('```'):
                clean_text = clean_text[:-3]
            
            try:
                parsed = json.loads(clean_text.strip())
                return jsonify({
                    'success': True,
                    'action': action,
                    'result': parsed
                })
            except json.JSONDecodeError:
                # Se não conseguir parsear, retorna texto bruto
                return jsonify({
                    'success': True,
                    'action': action,
                    'result': {'raw': result_text}
                })
        else:
            # Para summary, retorna texto
            return jsonify({
                'success': True,
                'action': action,
                'result': {'text': result_text}
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Erro ao processar: {str(e)}'
        }), 500
