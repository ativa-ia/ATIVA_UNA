"""
Rotas da API do Assistente Socrático
Aula Invertida - O aluno explica, o assistente desafia com perguntas
"""
from flask import Blueprint, request, jsonify
from app.middleware.auth_middleware import token_required
from app.services.ai_service import generate_content_with_prompt

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


SOCRATIC_SYSTEM_PROMPT = """Você é Sócrates, um assistente educacional socrático amigável e sábio para alunos universitários.
Sua abordagem é baseada no método socrático: você NUNCA dá respostas diretas. Em vez disso, guia o aluno através de perguntas reflexivas.

Seu objetivo:
1. Ouvir a explicação do aluno sobre o que ele entendeu
2. Identificar lacunas no entendimento, misconceptions (conceitos errôneos) ou pontos que podem ser aprofundados
3. Fazer perguntas que levem o aluno a refletir e descobrir por conta própria

Regras de comportamento:
- NUNCA dê a resposta diretamente. Sempre faça perguntas
- Elogie os acertos de forma ESPECÍFICA ("Muito bem! Você identificou corretamente que...")
- Quando o aluno errar, NÃO corrija diretamente. Faça uma pergunta que o leve a perceber o erro
- Use linguagem acessível e amigável (pode usar "você", tom informal mas respeitoso)
- Faça no máximo 2–3 perguntas por vez para não sobrecarregar
- Se o aluno demonstrar domínio, desafie com perguntas mais avançadas ou peça aplicações práticas
- Se o aluno parecer confuso, simplifique e volte aos conceitos básicos
- Use analogias quando possível para ajudar na compreensão
- Seja encorajador e motivador

Formato de resposta:
- Comece com um breve comentário sobre o que o aluno disse (elogio ou observação)
- Faça suas perguntas socráticas
- Mantenha respostas concisas (máximo 3-4 parágrafos)
- Use emojis com moderação para tornar a conversa mais leve (🤔 💡 ✨)

A disciplina atual é: {subject_name}"""


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


@socratic_bp.route('/chat', methods=['POST'])
@token_required
def socratic_chat(current_user):
    """
    Chat socrático: recebe a explicação do aluno e retorna perguntas desafiadoras.
    
    Body:
    {
        "subject_name": str,         (nome da disciplina)
        "messages": [                (histórico da conversa)
            { "role": "user"|"assistant", "content": str }
        ],
        "student_text": str          (mensagem atual do aluno, já refinada)
    }
    """
    data = request.get_json() or {}
    subject_name = data.get('subject_name', 'Geral')
    messages = data.get('messages', [])
    student_text = data.get('student_text', '').strip()
    
    if not student_text:
        return jsonify({'success': False, 'error': 'Texto do aluno não fornecido'}), 400
    
    # Construir o system prompt com a disciplina
    system_prompt = SOCRATIC_SYSTEM_PROMPT.replace('{subject_name}', subject_name)
    
    # Construir o prompt completo com histórico
    # Limitar histórico a últimas 20 mensagens para não estourar token
    recent_messages = messages[-20:] if len(messages) > 20 else messages
    
    conversation_context = ""
    if recent_messages:
        conversation_context = "Histórico da conversa até agora:\n"
        for msg in recent_messages:
            role_label = "Aluno" if msg.get('role') == 'user' else "Sócrates"
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
        
        return jsonify({
            'success': True,
            'response': response.strip()
        })
    except Exception as e:
        print(f"[SOCRATIC] Erro no chat: {e}")
        return jsonify({
            'success': False,
            'error': f'Erro interno: {str(e)}'
        }), 500
