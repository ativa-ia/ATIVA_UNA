
@transcription_bp.route('/activities/<int:activity_id>/ai_summary', methods=['POST'])
@token_required
def generate_ai_summary_for_activity(current_user, activity_id):
    """
    Gera um resumo do assunto abordado na atividade usando IA.
    Útil para enviar como material de reforço.
    """
    from app.services.ai_service import generate_content_with_prompt
    
    activity = LiveActivity.query.get(activity_id)
    if not activity:
        return jsonify({'success': False, 'error': 'Atividade não encontrada'}), 404
        
    # Construir o contexto base
    context_text = ""
    activity_type = activity.activity_type
    
    if activity_type == 'quiz':
        # Extrair perguntas e respostas para formar o contexto
        questions = activity.questions.get('questions', []) if activity.questions else []
        context_text = f"Quiz: {activity.title}\n\n"
        for i, q in enumerate(questions):
            context_text += f"Q{i+1}: {q.get('question')}\n"
            # Adicionar opções para contexto se necessário
            options = q.get('options', [])
            context_text += f"Opções: {', '.join(options)}\n"
            # Resposta correta
            correct_idx = q.get('correct', 0)
            if 0 <= correct_idx < len(options):
                 context_text += f"Resposta Correta: {options[correct_idx]}\n"
            context_text += "\n"
            
    elif activity_type == 'summary':
         # Para resumo, o contexto é o próprio conteúdo gerado ou o prompt original?
         # Geralmente 'summary' activities são geradas de um texto. O activity.content pode ter o texto original?
         # Se não, usamos o título e contexto geral.
         context_text = f"Resumo sobre: {activity.title}\n{activity.ai_generated_content or ''}"
         
    else: # open_question
         context_text = f"Pergunta Aberta: {activity.title}\n{activity.questions.get('question', '') if activity.questions else ''}"

    system_instruction = """Você é um professor particular experiente e didático.
Sua tarefa é criar um RESUMO EXPLICATIVO para um aluno que teve dificuldades neste assunto.
O resumo deve:
1. Explicar os conceitos principais abordados nas questões/tópicos abaixo.
2. Ser claro, encorajador e fácil de entender.
3. Focar em esclarecer as dúvidas prováveis (baseado nas questões).
4. Ter cerca de 300 palavras.
5. Usar linguagem direta (sem markdown complexo, apenas parágrafos)."""

    prompt = f"""Baseado no seguinte conteúdo de atividade avaliativa, crie um material de revisão para o aluno:

{context_text}

Gere um resumo que explique o assunto para que o aluno possa estudar e melhorar seu desempenho."""

    summary = generate_content_with_prompt(system_instruction, prompt)
    
    return jsonify({
        'success': True,
        'summary': summary
    })
