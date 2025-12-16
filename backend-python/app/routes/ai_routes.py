"""
Rotas da API de IA
"""
from flask import Blueprint, request, jsonify, Response, stream_with_context
from app.middleware.auth_middleware import token_required
from app.services.ai_service import chat_with_ai, chat_stream, create_or_get_session, generate_content_with_prompt
from app.models.ai_session import AISession, AIMessage
from datetime import datetime
from app import db

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
            import json
            for chunk in chat_stream(current_user.id, subject_id, message):
                if chunk:
                    yield f"data: {json.dumps({'text': chunk})}\n\n"
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
        response = chat_with_ai(current_user.id, subject_id, message)
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


@ai_bp.route('/sessions/<int:subject_id>/all', methods=['GET'])
@token_required
def list_sessions(current_user, subject_id):
    """Lista todas as sessões de chat da disciplina"""
    sessions = AISession.query.filter_by(
        teacher_id=current_user.id,
        subject_id=subject_id
    ).order_by(AISession.started_at.desc()).all()
    
    return jsonify({
        'success': True,
        'sessions': [s.to_dict() for s in sessions]
    })


@ai_bp.route('/session/new', methods=['POST'])
@token_required
def create_new_session(current_user):
    """
    Cria uma NOVA sessão de chat (arquiva a anterior se houver)
    Body: { "subject_id": int }
    """
    data = request.get_json()
    subject_id = data.get('subject_id')
    
    if not subject_id:
        return jsonify({'success': False, 'error': 'ID da disciplina necessário'}), 400

    from datetime import datetime
    
    # 1. Encontrar sessão ativa anterior e encerrar (opcional, mas bom pra organização)
    active_session = AISession.query.filter_by(
        teacher_id=current_user.id,
        subject_id=subject_id,
        status='active'
    ).first()
    
    if active_session:
        active_session.status = 'ended'
        active_session.ended_at = datetime.utcnow()
    
    # 2. Criar nova sessão
    new_session = AISession(
        teacher_id=current_user.id,
        subject_id=subject_id,
        status='active'
    )
    db.session.add(new_session)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'session': new_session.to_dict()
    })


@ai_bp.route('/session/<int:session_id>/activate', methods=['POST'])
@token_required
def activate_session(current_user, session_id):
    """
    Ativa uma sessão específica e desativa (arquiva) as outras da mesma disciplina.
    Isso permite que o usuário retome uma conversa antiga como a principal.
    """
    session = AISession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
        
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403

    # 1. Desativar qualquer outra sessão ativa desta disciplina
    active_sessions = AISession.query.filter_by(
        teacher_id=current_user.id,
        subject_id=session.subject_id,
        status='active'
    ).all()
    
    for s in active_sessions:
        if s.id != session.id:
            s.status = 'ended'
            s.ended_at = datetime.utcnow()
            
    # 2. Ativar a sessão alvo
    session.status = 'active'
    session.ended_at = None # Remove data de fim pois está ativa novamente
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'session': session.to_dict()
    })


@ai_bp.route('/session/<int:session_id>', methods=['DELETE'])
@token_required
def delete_session(current_user, session_id):
    """Exclui uma sessão de chat e todo seu conteúdo (mensagens e arquivos)"""
    session = AISession.query.get(session_id)
    
    if not session:
        return jsonify({'success': False, 'error': 'Sessão não encontrada'}), 404
        
    if session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Não autorizado'}), 403
        
    # Exclusão manual dos relacionamentos (caso cascade não resolva tudo ou para segurança extra)
    # Arquivos de Contexto
    from app.models.ai_session import AIContextFile
    AIContextFile.query.filter_by(session_id=session.id).delete()
    
    # Mensagens (já tem cascade no model, mas garantindo)
    AIMessage.query.filter_by(session_id=session.id).delete()
    
    db.session.delete(session)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Sessão excluída com sucesso'
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
        "content": "string",
        "action": "string",       # 'quiz', 'summary', 'discussion'
        "subject_id": int
    }
    """
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
    
    prompts = {
        'quiz': {
            'system': """Você é um professor criando um quiz educacional.
Gere EXATAMENTE 10 perguntas de múltipla escolha em formato JSON.
Cada pergunta deve ter 4 alternativas (A, B, C, D).
Responda APENAS com o JSON, sem texto adicional:
{
  "questions": [
    {
      "question": "Texto da pergunta?",
      "options": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
      "correct": 0
    }
  ]
}
IMPORTANTE: "correct" é o índice da resposta correta (0=A, 1=B, 2=C, 3=D)""",
            'json_mode': True,
            'template': f"""Com base no seguinte conteúdo:
---
{content}
---"""
        },

        'summary': {
            'system': """Você é um professor criando material didático.
Crie um resumo didático e bem estruturado com:
1. Título do tema
2. Pontos principais (em tópicos)
3. Conceitos-chave para memorizar
4. Conclusão
Seja claro e objetivo. Use linguagem acessível para estudantes.""",
            'json_mode': False,
            'template': f"""Com base no seguinte conteúdo:
---
{content}
---"""
        },

        'discussion': {
            'system': """Você é um professor preparando uma discussão em sala.
Gere EXATAMENTE 5 perguntas para discussão em grupo.
As perguntas devem estimular pensamento crítico e debate.
Responda em formato JSON:
{
  "questions": [
    {
      "question": "Pergunta para discussão?",
      "objective": "O que a pergunta busca desenvolver nos alunos"
    }
  ]
}""",
            'json_mode': True,
            'template': f"""Com base no seguinte conteúdo:
---
{content}
---"""
        }
    }
    
    try:
        config = prompts[action]
        result_text = generate_content_with_prompt(
            system_instruction=config['system'],
            prompt=config['template'],
            json_mode=config['json_mode']
        )
        
        # Para quiz e discussion, tentar parsear como JSON
        if action in ['quiz', 'discussion']:
            try:
                parsed = json.loads(result_text.strip())
                return jsonify({
                    'success': True,
                    'action': action,
                    'result': parsed
                })
            except json.JSONDecodeError:
                # Se não conseguir parsear, tenta limpar markdown ou retorna erro
                try: 
                    # Last ditch effort for common markdown wrapping
                    cleaned = result_text.replace('```json', '').replace('```', '').strip()
                    parsed = json.loads(cleaned)
                    return jsonify({
                        'success': True,
                        'action': action,
                        'result': parsed
                    })
                except:
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

@ai_bp.route('/upload-context', methods=['POST'])
@token_required
def upload_context(current_user):
    """
    Endpoint para upload de arquivos de contexto (NotebookLM style)
    Suporta PDF e TXT via Upload Direto ou URL (Supabase Storage)
    """
    import io
    import requests
    from app import db
    from app.models.ai_session import AIContextFile
    from pypdf import PdfReader
    
    file_stream = None
    filename = None
    subject_id = None
    file_type = "text"
    
    # 1. Check if JSON (URL from Supabase)
    if request.is_json:
        data = request.get_json()
        print(f"DEBUG UPLOAD: Received data: {data}")
        file_url = data.get('file_url')
        subject_id = data.get('subject_id')
        session_id = data.get('session_id')
        filename = data.get('filename', 'downloaded_file.pdf')
        
        if not file_url:
            return jsonify({'success': False, 'error': 'URL do arquivo não fornecida'}), 400
            
        try:
            # Download file from Storage
            response = requests.get(file_url)
            response.raise_for_status()
            file_stream = io.BytesIO(response.content)
        except Exception as e:
            return jsonify({'success': False, 'error': f'Erro ao baixar arquivo do Storage: {str(e)}'}), 400

    # 2. Check if Multipart Form Data (Direct Upload)
    elif 'file' in request.files:
        file = request.files['file']
        subject_id = request.form.get('subject_id')
        session_id = request.form.get('session_id')
        filename = file.filename
        
        if not file or filename == '':
            return jsonify({'success': False, 'error': 'Arquivo inválido'}), 400
            
        file_stream = file
    
    else:
        return jsonify({'success': False, 'error': 'Requisição inválida (esperado arquivo ou url)'}), 400
    
    
    if not subject_id or not session_id:
        return jsonify({'success': False, 'error': 'ID da disciplina e ID da sessão necessários'}), 400
        
    try:
        content = ""
        
        # Extração de texto
        if filename.lower().endswith('.pdf'):
            file_type = "pdf"
            try:
                pdf_reader = PdfReader(file_stream)
                for page in pdf_reader.pages:
                    content += page.extract_text() + "\n"
            except Exception as e:
                # Fallback for some PDFs or connection issues
                print(f"Error reading PDF: {e}")
                return jsonify({'success': False, 'error': 'Erro ao ler PDF. O arquivo pode estar corrompido ou protegido.'}), 400
                
        elif filename.lower().endswith('.docx'):
            file_type = "docx"
            from docx import Document as DocxDocument
            try:
                doc = DocxDocument(file_stream)
                for para in doc.paragraphs:
                    content += para.text + "\n"
            except Exception as e:
                 return jsonify({'success': False, 'error': 'Erro ao ler DOCX.'}), 400
        else:
            # Assume text/plain
            if isinstance(file_stream, io.BytesIO):
                 content = file_stream.getvalue().decode('utf-8', errors='ignore')
            else:
                 content = file_stream.read().decode('utf-8', errors='ignore')
            
        if not content.strip():
            return jsonify({'success': False, 'error': 'Não foi possível extrair texto do arquivo (conteúdo vazio ou imagem)'}), 400
            
        if not content.strip():
            return jsonify({'success': False, 'error': 'Não foi possível extrair texto do arquivo'}), 400
            
        # Salvar no banco vinculado à SESSÃO
        context_file = AIContextFile(
            subject_id=subject_id,
            session_id=session_id, # Linkar à sessão específica
            filename=filename,
            content=content,
            file_type=file_type
        )
        db.session.add(context_file)
        db.session.commit()
        
        # Gerar sugestões de perguntas
        from app.services.ai_service import generate_study_questions
        suggestions = generate_study_questions(content)
        
        return jsonify({
            'success': True,
            'file': context_file.to_dict()
        })
        
    except Exception as e:
        print(f"Erro no upload: {e}")
        return jsonify({'success': False, 'error': f'Erro ao processar arquivo: {str(e)}'}), 500


@ai_bp.route('/context-files/<int:subject_id>', methods=['GET'])
@token_required
def get_context_files(current_user, subject_id):
    """
    Lista arquivos de contexto (da sessão atual ou todos se não tiver session_id na query)
    Query param: session_id (opcional)
    """
    from app.models.ai_session import AIContextFile
    
    session_id = request.args.get('session_id')
    
    query = AIContextFile.query.filter_by(subject_id=subject_id)
    
    if session_id:
        query = query.filter_by(session_id=session_id)
        
    files = query.order_by(AIContextFile.created_at.desc()).all()
    
    return jsonify({
        'success': True,
        'files': [f.to_dict() for f in files]
    })


@ai_bp.route('/context-files/<int:file_id>', methods=['DELETE'])
@token_required
def delete_context_file(current_user, file_id):
    """Remove um arquivo de contexto"""
    from app import db
    from app.models.ai_session import AIContextFile
    
    file = AIContextFile.query.get(file_id)
    if not file:
        return jsonify({'success': False, 'error': 'Arquivo não encontrado'}), 404
        
    subject_id = file.subject_id
    db.session.delete(file)
    db.session.commit()
    
    # Verificar se ainda existem arquivos para esta disciplina
    remaining = AIContextFile.query.filter_by(subject_id=subject_id).count()
    
    if remaining == 0:
        # Se não há mais arquivos, fazer RESET TOTAL (Limpar histórico)
        try:
            from app.models.chat import ChatMessage
            from app.models.ai_session import AISession, AIMessage
            
            # 1. Limpar Chat UI
            ChatMessage.clear_history(current_user.id, subject_id)
            
            # 2. Limpar Memória IA
            ai_session = AISession.query.filter_by(
                teacher_id=current_user.id, 
                subject_id=subject_id
            ).first()
            
            if ai_session:
                AIMessage.query.filter_by(session_id=ai_session.id).delete()
                db.session.commit()
        except Exception as e:
            print(f"Erro ao limpar histórico automático: {e}")
    
    return jsonify({'success': True})


@ai_bp.route('/generate-suggestions', methods=['POST'])
@token_required
def generate_suggestions_route(current_user):
    """Gera sugestões baseadas no último arquivo enviado"""
    try:
        data = request.get_json()
        subject_id = data.get('subject_id')
        
        if not subject_id:
            return jsonify({'success': False, 'error': 'Subject ID required'}), 400
            
        from app.models.ai_session import AIContextFile
        # Pega o último arquivo adicionado
        latest_file = AIContextFile.query.filter_by(subject_id=subject_id).order_by(AIContextFile.created_at.desc()).first()
        
        if not latest_file:
            return jsonify({'success': True, 'suggestions': []})
            
        from app.services.ai_service import generate_study_questions
        suggestions = generate_study_questions(latest_file.content)
        
        return jsonify({
            'success': True,
            'suggestions': suggestions
        })
    except Exception as e:
        print(f"Erro ao gerar sugestões: {e}")

@ai_bp.route('/share-content', methods=['POST'])
@token_required
def share_content(current_user):
    """
    Compartilha conteúdo IA (Quiz/Resumo) diretamente com a turma.
    Se não houver sessão de transcrição ativa, cria uma automaticamente.
    """
    from app import db
    from app.models.transcription_session import TranscriptionSession, LiveActivity
    from datetime import datetime, timedelta
    import json
    
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
        
    subject_id = data.get('subject_id')
    content = data.get('content') # Pode ser string (Resumo) ou Dict/JSON String (Quiz)
    activity_type = data.get('type') # 'quiz' ou 'summary'
    title = data.get('title', 'Atividade IA')
    
    if not subject_id or not content or not activity_type:
        return jsonify({'success': False, 'error': 'Campos obrigatórios: subject_id, content, type'}), 400
        
    try:
        # 1. Encontrar ou Criar Sessão
        # Primeiro tenta achar uma sessão ativa para "anexar" a atividade nela
        session = TranscriptionSession.query.filter_by(
            subject_id=subject_id,
            teacher_id=current_user.id,
            status='active'
        ).order_by(TranscriptionSession.created_at.desc()).first()
        
        if not session:
            # Se não houver, cria uma sessão dedicada para atividades de IA
            session = TranscriptionSession(
                subject_id=subject_id,
                teacher_id=current_user.id,
                title=f"Atividade IA - {datetime.utcnow().strftime('%d/%m %H:%M')}",
                status='active',
                full_transcript="[Sessão gerada automaticamente para compartilhamento de conteúdo via IA]"
            )
            db.session.add(session)
            db.session.flush() # Gerar ID
            
        # 2. Preparar Conteúdo
        final_content = content
        ai_text = ""
        
        if activity_type == 'quiz':
            # Garantir que content seja um dicionário válido
            if isinstance(content, str):
                try:
                    # Tentar limpar blocos de markdown se houver
                    clean_content = content
                    if "```" in content:
                        import re
                        clean_content = re.sub(r'```json\s*|\s*```', '', content).strip()
                    
                    final_content = json.loads(clean_content)
                    ai_text = content # Guarda o original como texto gerado
                except Exception as e:
                    return jsonify({'success': False, 'error': f'Conteúdo de Quiz inválido: {str(e)}'}), 400
            elif isinstance(content, dict):
                final_content = content
                ai_text = json.dumps(content)
        
        elif activity_type == 'summary':
            # Para resumo, o content geralmente é o texto.
            # Mas LiveActivity espera um JSON no campo 'content'.
            # Vamos estruturar.
            if isinstance(content, str):
                ai_text = content
                final_content = {'summary_text': content}
            else:
                # Se já vier estruturado
                final_content = content
                ai_text = str(content)

        # 3. Criar a Atividade
        activity = LiveActivity(
            session_id=session.id,
            checkpoint_id=None, # Não vinculado a um momento específico da transcrição
            activity_type=activity_type,
            title=title,
            content=final_content,
            ai_generated_content=ai_text,
            shared_with_students=True, # Já nasce compartilhada
            status='active',
            starts_at=datetime.utcnow(),
            # Definir tempo limite padrão se necessário (5 min para quiz)
            time_limit=300 if activity_type == 'quiz' else None
        )
        
        if activity.time_limit:
            activity.ends_at = activity.starts_at + timedelta(seconds=activity.time_limit)
            
        db.session.add(activity)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Conteúdo compartilhado com sucesso!',
            'activity': activity.to_dict()
        })

    except Exception as e:
        db.session.rollback()
        print(f"ERRO CRÍTICO AO COMPARTILHAR CONTEÚDO: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': f'Erro interno: {str(e)}'}), 500


@ai_bp.route('/convert-content', methods=['POST'])
@token_required
def convert_content(current_user):
    """Converte conteúdo para o formato especificado usando IA"""
    try:
        data = request.get_json()
        content = data.get('content')
        target_type = data.get('type')
        
        if not content or not target_type:
            return jsonify({'success': False, 'error': 'Conteúdo e tipo são obrigatórios'}), 400
            
        from app.services.ai_service import generate_quiz, generate_summary, format_to_quiz_json
        
        result = ""
        if target_type == 'quiz':
            # Gera quiz (que já vem em JSON string)
            # Se a intenção é CONVERTER um texto que já tem perguntas, usar format_to_quiz_json
            # Se a intenção fosse GERAR do zero, seria generate_quiz.
            # Como a chamamos de 'convert-content', o usuário espera fidelidade.
            result = format_to_quiz_json(content)
        elif target_type == 'summary':
            result = generate_summary(content)
        else:
            return jsonify({'success': False, 'error': 'Tipo inválido'}), 400
            
        return jsonify({'success': True, 'result': result})
        
    except Exception as e:
        print(f"Erro ao converter conteúdo: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
