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


# @ai_bp.route('/chat', methods=['POST'])
# @token_required
# def chat(current_user):
#     """
#     Endpoint para chat com IA (DESATIVADO - MIGRADO PARA N8N)
#     """
#     return jsonify({'success': False, 'error': 'Endpoint desativado. Use o sistema de transcrição.'}), 410
    
    # data = request.get_json()
    
    # if not data:
    #     return jsonify({'success': False, 'error': 'Dados não fornecidos'}), 400
    
    # message = data.get('message')
    # subject_id = data.get('subject_id')
    # stream = data.get('stream', False)
    
    # if not message:
    #     return jsonify({'success': False, 'error': 'Mensagem não fornecida'}), 400
    
    # if not subject_id:
    #     return jsonify({'success': False, 'error': 'ID da disciplina não fornecido'}), 400
    
    # if stream:
    #     # Resposta em streaming
    #     def generate():
    #         import json
    #         for chunk in chat_stream(current_user.id, subject_id, message):
    #             if chunk:
    #                 yield f"data: {json.dumps({'text': chunk})}\n\n"
    #         yield "data: [DONE]\n\n"
        
    #     return Response(
    #         stream_with_context(generate()),
    #         mimetype='text/event-stream',
    #         headers={
    #             'Cache-Control': 'no-cache',
    #             'Connection': 'keep-alive',
    #             'X-Accel-Buffering': 'no'
    #         }
    #     )
    # else:
    #     # Resposta normal
    #     response = chat_with_ai(current_user.id, subject_id, message)
    #     return jsonify({
    #         'success': True,
    #         'response': response
    #     })


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
    [DEPRECATED] Antigo endpoint para gerar quiz/resumo.
    Desativado na migração para Sistema de Transcrição.
    """
    return jsonify({'success': False, 'error': 'Endpoint desativado.'}), 410

@ai_bp.route('/upload-context', methods=['POST'])
@token_required
def upload_context(current_user):
    """
    Endpoint para upload de arquivos de contexto.
    Agora INTEGRADO COM WOHBOOK N8N para vetorização.
    """
    import io
    import requests
    import os
    from app import db
    from app.models.ai_session import AIContextFile
    from app.models.subject import Subject
    from app.services.ai_service import create_or_get_session
    
    file_stream = None
    filename = None
    subject_id = None
    file_type = "document"
    file_url = None
    
    # 1. Recuperar dados (Suporta JSON com URL ou Multipart)
    if request.is_json:
        data = request.get_json()
        print(f"DEBUG UPLOAD: Received data: {data}")
        file_url = data.get('file_url')
        subject_id = data.get('subject_id')
        session_id = data.get('session_id') # Opcional agora
        filename = data.get('filename', 'downloaded_file.pdf')
        
        if not file_url:
            return jsonify({'success': False, 'error': 'URL do arquivo não fornecida'}), 400
            
    elif 'file' in request.files:
        # Fallback para upload direto se necessário, mas frontend usa URL
        file = request.files['file']
        subject_id = request.form.get('subject_id')
        session_id = request.form.get('session_id')
        filename = file.filename
        
        if not file or filename == '':
            return jsonify({'success': False, 'error': 'Arquivo inválido'}), 400
            
        file_stream = file
    
    if not subject_id:
        return jsonify({'success': False, 'error': 'ID da disciplina necessário'}), 400
        
    try:
        # 2. Obter nome da disciplina (classroom_id para o N8N)
        subject = Subject.query.get(subject_id)
        if not subject:
             return jsonify({'success': False, 'error': 'Disciplina não encontrada'}), 404
             
        classroom_id = subject.name # Usando o NOME como ID para o fluxo
        
        # 3. Preparar arquivo para envio ao N8N
        files_to_send = {}
        
        if file_url:
            # Baixar do Supabase para re-enviar (N8N precisa do arquivo físico para vetorizar conteúdo, não só link)
            try:
                print(f"Baixando arquivo de: {file_url}")
                response = requests.get(file_url)
                response.raise_for_status()
                
                # Determinar MIME Type correto
                mime_type = response.headers.get('Content-Type')
                if not mime_type or mime_type == 'application/octet-stream':
                    import mimetypes
                    guessed_type, _ = mimetypes.guess_type(filename)
                    if guessed_type:
                        mime_type = guessed_type
                    else:
                        mime_type = 'application/pdf' # Último recurso
                        
                print(f"File MIME Type: {mime_type}")
                
                files_to_send = {'file': (filename, response.content, mime_type)}
            except Exception as e:
                return jsonify({'success': False, 'error': f'Erro ao baixar arquivo do Storage: {str(e)}'}), 400
        elif file_stream:
             files_to_send = {'file': (filename, file_stream, file_stream.content_type)}
             
        # 4. Enviar para Webhook N8N
        n8n_url = os.getenv('N8N_WEBHOOK_UPLOAD')
        if not n8n_url:
             print("AVISO: N8N_WEBHOOK_UPLOAD não configurada. Pulando envio ao N8N.")
        else:
            try:
                print(f"Enviando para N8N: {n8n_url} | Classroom: {classroom_id}")
                # Enviar multipart/form-data
                n8n_response = requests.post(
                    n8n_url,
                    files=files_to_send,
                    data={'classroom_id': classroom_id}
                )
                print(f"N8N Response: {n8n_response.status_code} - {n8n_response.text}")
                
                if n8n_response.status_code >= 400:
                    print(f"Erro no N8N: {n8n_response.text}")
                    # Não vamos travar o processo se o N8N falhar? Ou vamos? 
                    # Por enquanto apenas logamos erro, mas salvamos registro local.
            except Exception as e:
                print(f"EXCEÇÃO AO CHAMAR N8N: {str(e)}")

        # 5. Salvar Registro Local (Para listar na UI)
        # Não extraímos mais texto localmente.
        placeholder_content = "[Enviado para Vetorização]"
        
        # Se não tiver session_id (novo fluxo), podemos criar dummy ou deixar null se o model aceitar
        # Model pede session_id nullable=False? Vamos checar. Se for, precisamos de uma session.
        # Mas o frontend novo não gerencia sessões de chat.
        # Vamos contornar buscando qualquer sessão ativa ou criando uma dummy se necessário?
        # Ou melhor: vamos alterar o Model AIContextFile para session_id ser nullable no futuro?
        # Por enquanto, hack: pegar primeira sessão da materia ou criar.
        
        session = None
        if session_id:
             session = create_or_get_session(current_user.id, subject_id) # Valida se existe
        else:
             # Tenta pegar qualquer uma ou cria
             session = create_or_get_session(current_user.id, subject_id)
        
        context_file = AIContextFile(
            subject_id=subject_id,
            session_id=session.id, 
            filename=filename,
            content=placeholder_content,
            file_type=file_type
        )
        db.session.add(context_file)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'file': context_file.to_dict(),
            'message': 'Arquivo enviado para processamento'
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
    """[DEPRECATED] Gera sugestões baseadas no último arquivo enviado"""
    return jsonify({'success': True, 'suggestions': []})

@ai_bp.route('/share-content', methods=['POST'])
@token_required
def share_content(current_user):
    """
    [DEPRECATED] Compartilha conteúdo IA.
    """
    return jsonify({'success': False, 'error': 'Endpoint desativado.'}), 410


@ai_bp.route('/convert-content', methods=['POST'])
@token_required
def convert_content(current_user):
    """[DEPRECATED] Converte conteúdo"""
    return jsonify({'success': False, 'error': 'Endpoint desativado.'}), 410
