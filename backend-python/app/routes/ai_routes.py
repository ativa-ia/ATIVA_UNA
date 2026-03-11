"""
Rotas da API de IA
"""
from flask import Blueprint, request, jsonify, Response, stream_with_context
from app.middleware.auth_middleware import token_required
from app.services.ai_service import chat_with_ai, chat_stream, create_or_get_session, generate_content_with_prompt
from app.models.ai_session import AISession, AIMessage
from datetime import datetime
from app import db
from app.services.google_drive_service import GoogleDriveService

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


@ai_bp.route('/session/<int:class_subject_id>', methods=['GET'])
@token_required
def get_session(current_user, class_subject_id):
    """Retorna ou cria sessão ativa para a oferta de disciplina"""
    session = create_or_get_session(current_user.id, class_subject_id)
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


@ai_bp.route('/sessions/<int:class_subject_id>/all', methods=['GET'])
@token_required
def list_sessions(current_user, class_subject_id):
    """Lista todas as sessões de chat da oferta de disciplina"""
    sessions = AISession.query.filter_by(
        teacher_id=current_user.id,
        class_subject_id=class_subject_id
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
    Body: { "class_subject_id": int }
    """
    data = request.get_json()
    class_subject_id = data.get('class_subject_id')
    
    if not class_subject_id:
        return jsonify({'success': False, 'error': 'ID da oferta de disciplina necessário'}), 400

    from datetime import datetime
    
    # 1. Encontrar sessão ativa anterior e encerrar
    active_session = AISession.query.filter_by(
        teacher_id=current_user.id,
        class_subject_id=class_subject_id,
        status='active'
    ).first()
    
    if active_session:
        active_session.status = 'ended'
        active_session.ended_at = datetime.utcnow()
    
    # 2. Criar nova sessão
    new_session = AISession(
        teacher_id=current_user.id,
        class_subject_id=class_subject_id,
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
        class_subject_id=session.class_subject_id,
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
    class_subject_id = None
    session_id = None
    file_type = "document"
    file_url = None
    file_path = None  # CORREÇÃO: Inicializar aqui
    
    # 1. Recuperar dados (Suporta JSON com URL ou Multipart)
    if request.is_json:
        data = request.get_json()
        print(f"DEBUG UPLOAD: Received data: {data}")
        file_url = data.get('file_url')
        class_subject_id = data.get('class_subject_id') or data.get('subject_id')  # retrocompat
        session_id = data.get('session_id')
        filename = data.get('filename', 'downloaded_file.pdf')
        
        # Extrair file_path do file_url (path após o bucket)
        if file_url:
            try:
                # URL formato: https://...supabase.co/storage/v1/object/public/BUCKET/path/to/file.pdf
                # Extrair: path/to/file.pdf
                from urllib.parse import urlparse
                parsed = urlparse(file_url)
                path_parts = parsed.path.split('/public/')
                if len(path_parts) > 1:
                    file_path = path_parts[1]
            except:
                file_path = None
        
        if not file_url:
            return jsonify({'success': False, 'error': 'URL do arquivo não fornecida'}), 400
            
    elif 'file' in request.files:
        # Fallback para upload direto se necessário, mas frontend usa URL
        file = request.files['file']
        class_subject_id = request.form.get('class_subject_id') or request.form.get('subject_id')
        session_id = request.form.get('session_id')
        filename = file.filename
        # file_url e file_path já inicializados no topo, atualizar após upload Drive
        
        if not file or filename == '':
            return jsonify({'success': False, 'error': 'Arquivo inválido'}), 400
            
        try:
            # Upload para Google Drive
            print(f"Fazendo upload para Google Drive: {filename}")
            drive_service = GoogleDriveService()
            drive_file = drive_service.upload_file(
                file, 
                filename, 
                file.content_type or 'application/octet-stream'
            )
            
            # Obter URL de visualização
            file_url = drive_file.get('webViewLink')
            print(f"Upload concluído. URL: {file_url}")
            
            # Resetar stream para uso posterior (envio p/ N8N)
            file.seek(0)
            file_stream = file
            
        except Exception as e:
            print(f"Erro no upload para Drive: {str(e)}")
            return jsonify({'success': False, 'error': f'Erro no upload: {str(e)}'}), 500
    
    if not class_subject_id:
        return jsonify({'success': False, 'error': 'ID da oferta de disciplina necessário'}), 400
        
    try:
        # 2. SEGURANÇA: Verificar se o professor tem acesso à oferta
        from app.models.teaching import Teaching
        from app.models.class_subject import ClassSubject
        cs = ClassSubject.query.get(class_subject_id)
        if not cs:
             return jsonify({'success': False, 'error': 'Oferta de disciplina não encontrada'}), 404
        
        subject = cs.subject
        
        # Verificar se o professor leciona esta oferta (relação via Teaching)
        teaching = Teaching.query.filter_by(
            teacher_id=current_user.id,
            class_subject_id=class_subject_id
        ).first()
        
        if not teaching:
            return jsonify({'success': False, 'error': 'Sem permissão para fazer upload nesta disciplina'}), 403
             
        classroom_id = subject.name  # Usando o NOME como ID para o fluxo
        
        # 3. Preparar arquivo para envio ao N8N
        files_to_send = {}
        
        if file_stream:
             # Prioridade: Arquivo já em memória (upload recente)
             files_to_send = {'file': (filename, file_stream, file_stream.content_type)}
             
        elif file_url:
            # Baixar de URL externa (Supabase ou outro link)
             files_to_send = {} # Initialize if needed within block logic structure
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
                
                # NOVO: Fazer upload para Google Drive também (para usar cota do usuário OAuth)
                try:
                    print(f"Fazendo upload para Google Drive: {filename}")
                    drive_service = GoogleDriveService()
                    # Criar stream de bytes a partir do conteúdo baixado
                    file_bytes = io.BytesIO(response.content)
                    drive_file = drive_service.upload_file(file_bytes, filename, mime_type)
                    # Atualizar file_url para apontar para Google Drive
                    file_url = drive_file.get('webViewLink')
                    file_path = drive_file.get('id')
                    print(f"Arquivo salvo no Google Drive: {file_url}")
                except Exception as drive_error:
                    print(f"Aviso: Falha ao fazer upload para Google Drive: {drive_error}")
                    # Não vamos bloquear o processo, mantém URL do Supabase
                    
             except Exception as e:
                return jsonify({'success': False, 'error': f'Erro ao baixar arquivo do Storage: {str(e)}'}), 400

             
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
             session = create_or_get_session(current_user.id, class_subject_id)
        else:
             session = create_or_get_session(current_user.id, class_subject_id)
        
        context_file = AIContextFile(
            class_subject_id=class_subject_id,
            session_id=session.id, 
            filename=filename,
            content=placeholder_content,
            file_type=file_type,
            file_url=file_url,
            file_path=file_path if file_url else None
        )
        db.session.add(context_file)  # CORREÇÃO: Estava faltando!
        db.session.commit()
        
        return jsonify({
            'success': True,
            'file_url': file_url,  # Frontend espera no nível raiz
            'file_path': file_path,  # Frontend espera no nível raiz
            'file': context_file.to_dict(),
            'message': 'Arquivo enviado para processamento'
        })
        
    except Exception as e:
        print(f"Erro no upload: {e}")
        return jsonify({'success': False, 'error': f'Erro ao processar arquivo: {str(e)}'}), 500


@ai_bp.route('/documents/<int:class_subject_id>', methods=['GET'])
@token_required
def get_subject_documents(current_user, class_subject_id):
    """
    Lista todos os documentos da Base de Conhecimento da oferta de disciplina
    Returns: { "success": bool, "documents": [{ "id": str, "filename": str, "created_at": str }] }
    """
    from app.models.ai_session import AIContextFile
    from app.models.class_subject import ClassSubject
    
    try:
        # SEGURANÇA: Verificar se o professor tem acesso
        from app.models.teaching import Teaching
        cs = ClassSubject.query.get(class_subject_id)
        if not cs:
            return jsonify({'success': False, 'error': 'Oferta de disciplina não encontrada'}), 404
        
        teaching = Teaching.query.filter_by(
            teacher_id=current_user.id,
            class_subject_id=class_subject_id
        ).first()
        
        if not teaching:
            return jsonify({'success': False, 'error': 'Sem permissão para acessar esta disciplina'}), 403
        
        # Buscar todos os arquivos desta oferta
        files = AIContextFile.query.filter_by(class_subject_id=class_subject_id)\
            .order_by(AIContextFile.created_at.desc())\
            .all()
        
        documents = [{
            'id': str(file.id),
            'filename': file.filename,
            'created_at': file.created_at.isoformat() if file.created_at else None
        } for file in files]
        
        return jsonify({
            'success': True,
            'documents': documents
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao listar documentos: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@ai_bp.route('/documents/<int:file_id>/send-to-presentation', methods=['POST'])
@token_required
def send_kb_document_to_presentation(current_user, file_id):
    """
    Envia documento da Knowledge Base (AIContextFile) para apresentação
    Body: { "presentation_code": str }
    """
    from app.models.ai_session import AIContextFile
    from app.models.presentation import PresentationSession
    from app import db
    from datetime import datetime
    import logging
    
    logger = logging.getLogger(__name__)
    logger.info(f"[SEND KB DOC] Iniciando envio do documento {file_id}")
    
    try:
        data = request.get_json()
        logger.info(f"[SEND KB DOC] Request data: {data}")
        presentation_code = data.get('presentation_code')
        
        if not presentation_code:
            logger.warning("[SEND KB DOC] presentation_code não fornecido")
            return jsonify({
                'success': False,
                'error': 'presentation_code é obrigatório'
            }), 400
        
        # 1. Buscar arquivo da Knowledge Base
        logger.info(f"[SEND KB DOC] Buscando arquivo ID {file_id}")
        context_file = AIContextFile.query.filter_by(id=file_id).first()
        
        if not context_file:
            logger.warning(f"[SEND KB DOC] Documento {file_id} não encontrado")
            return jsonify({
                'success': False,
                'error': f'Documento {file_id} não encontrado'
            }), 404
        
        logger.info(f"[SEND KB DOC] Arquivo encontrado: {context_file.filename}")
        
        # 2. Buscar sessão de apresentação
        logger.info(f"[SEND KB DOC] Buscando apresentação {presentation_code}")
        session = PresentationSession.query.filter_by(code=presentation_code).first()
        
        if not session:
            logger.warning(f"[SEND KB DOC] Apresentação {presentation_code} não encontrada")
            return jsonify({
                'success': False,
                'error': f'Apresentação {presentation_code} não encontrada'
            }), 404
        
        if session.teacher_id != current_user.id:
            logger.warning(f"[SEND KB DOC] Usuário {current_user.id} não autorizado para apresentação {presentation_code}")
            return jsonify({
                'success': False,
                'error': 'Não autorizado'
            }), 403
        
        if session.status != 'active':
            logger.warning(f"[SEND KB DOC] Apresentação {presentation_code} não está ativa")
            return jsonify({
                'success': False,
                'error': 'Apresentação não está ativa'
            }), 400
        
        # 3. Preparar dados do documento para apresentação
        logger.info(f"[SEND KB DOC] Preparando dados do documento")
        
        # Se tiver file_url, enviar arquivo original
        if context_file.file_url:
            logger.info(f"[SEND KB DOC] Enviando arquivo original: {context_file.file_url}")
            document_data = {
                'filename': context_file.filename,
                'file_url': context_file.file_url,
                'supabase_url': context_file.file_url,
                'file_path': context_file.file_path,
                'file_type': context_file.file_type,
                'uploaded_at': context_file.created_at.isoformat() if context_file.created_at else None
            }
        else:
            # Fallback: converter texto em seções
            logger.info(f"[SEND KB DOC] Arquivo original não disponível, usando texto extraído")
            content_text = context_file.content or ""
            sections = []
            
            # Dividir por quebras duplas de linha (parágrafos)
            paragraphs = [p.strip() for p in content_text.split('\n\n') if p.strip()]
            
            # Agrupar parágrafos em seções de tamanho razoável (~2000 chars)
            current_section = ""
            section_counter = 0
            
            for para in paragraphs:
                if len(current_section) + len(para) > 2000 and current_section:
                    # Salvar seção atual
                    section_counter += 1
                    sections.append({
                        'section_id': section_counter,
                        'title': f'Seção {section_counter}',
                        'content': current_section.strip()
                    })
                    current_section = para
                else:
                    current_section += '\n\n' + para if current_section else para
            
            # Adicionar última seção
            if current_section:
                section_counter += 1
                sections.append({
                    'section_id': section_counter,
                    'title': f'Seção {section_counter}',
                    'content': current_section.strip()
                })
            
            # Se não houver seções, criar uma única seção com todo o conteúdo
            if not sections:
                sections = [{
                    'section_id': 1,
                    'title': context_file.filename,
                    'content': content_text
                }]
            
            document_data = {
                'file_id': context_file.id,
                'class_subject_id': context_file.class_subject_id,
                'filename': context_file.filename,
                'sections': sections,
                'total_sections': len(sections),
                'total_chunks': len(paragraphs),
                'file_type': context_file.file_type,
                'uploaded_at': context_file.created_at.isoformat() if context_file.created_at else None
            }
        
        # 4. Atualizar conteúdo da apresentação
        logger.info(f"[SEND KB DOC] Atualizando conteúdo da apresentação")
        session.current_content = {
            'type': 'document',
            'data': document_data,
            'timestamp': datetime.utcnow().isoformat()
        }
        db.session.commit()

        # Registrar evento para recap: documento exibido no telão
        try:
            from app.routes.lesson_recap_routes import log_lesson_event, find_active_transcription_session
            ts = find_active_transcription_session(current_user.id)
            if ts:
                doc_url = document_data.get('supabase_url') or document_data.get('file_url')
                log_lesson_event(
                    session_id=ts.id,
                    event_type='content_displayed',
                    event_data={
                        'content_type': 'document',
                        'title': document_data.get('filename') or 'Documento',
                        'url': doc_url,
                        'metadata': {
                            'file_type': document_data.get('file_type'),
                            'file_path': document_data.get('file_path'),
                            'subject_id': document_data.get('subject_id'),
                            'source': 'ai_context_file'
                        }
                    },
                    presentation_id=session.id,
                    triggered_by=current_user.id
                )
        except Exception as e:
            logger.error(f"[RECAP] Erro ao registrar content_displayed (KB doc): {e}")
        
        logger.info(f"[SEND KB DOC] -> Documento {context_file.filename} enviado para apresentação {presentation_code}")
        
        return jsonify({
            'success': True,
            'message': f'Documento "{context_file.filename}" enviado para apresentação',
            'document': document_data
        }), 200
        
    except Exception as e:
        logger.error(f"[SEND KB DOC] Error: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"[SEND KB DOC] Traceback: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ai_bp.route('/context-files/<int:class_subject_id>', methods=['GET'])
@token_required
def get_context_files(current_user, class_subject_id):
    """
    Lista arquivos de contexto (da sessão atual ou todos se não tiver session_id na query)
    Query param: session_id (opcional)
    """
    from app.models.ai_session import AIContextFile
    
    session_id = request.args.get('session_id')
    
    query = AIContextFile.query.filter_by(class_subject_id=class_subject_id)
    
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
        
    class_subject_id = file.class_subject_id
    db.session.delete(file)
    db.session.commit()
    
    # Verificar se ainda existem arquivos para esta oferta
    remaining = AIContextFile.query.filter_by(class_subject_id=class_subject_id).count()
    
    if remaining == 0:
        # Se não há mais arquivos, fazer RESET TOTAL (Limpar histórico)
        try:
            from app.models.chat import ChatMessage
            from app.models.ai_session import AISession, AIMessage
            
            # 1. Limpar Chat UI
            ChatMessage.clear_history(current_user.id, class_subject_id)
            
            # 2. Limpar Memória IA
            ai_session = AISession.query.filter_by(
                teacher_id=current_user.id, 
                class_subject_id=class_subject_id
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
# Novos endpoints para controle de PDF via comandos de voz

@ai_bp.route('/pdf/next-page', methods=['POST'])
@token_required
def pdf_next_page(current_user):
    """
    Avança para próxima página do PDF
    Body: { "presentation_code": str }
    """
    from app.models.presentation import PresentationSession
    from app import db
    import json
    
    data = request.get_json()
    presentation_code = data.get('presentation_code')
    
    if not presentation_code:
        return jsonify({'success': False, 'error': 'Código da apresentação necessário'}), 400
    
    from datetime import datetime
    
    # Imports movidos para o topo em refatoração ideal, mantendo aqui por enquanto
    
    session = PresentationSession.query.filter_by(code=presentation_code).first()
    if not session or session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Apresentação não encontrada'}), 404
    
    # Obter current_content
    # Coluna db.JSON já retorna dict, não precisa de json.loads
    content = dict(session.current_content) if session.current_content else {}
    
    # Incrementar página
    current_page = content.get('pdf_page', 1)
    content['pdf_page'] = current_page + 1
    
    # Atualizar timestamp para forçar polling refresh
    content['timestamp'] = datetime.utcnow().isoformat()
    
    # Salvar
    # Coluna db.JSON espera dict, não string JSON
    from sqlalchemy.orm.attributes import flag_modified
    session.current_content = content
    flag_modified(session, "current_content") # Forçar detecção de mudança em JSON mutável
    db.session.commit()
    
    return jsonify({'success': True, 'page': content['pdf_page']})


@ai_bp.route('/pdf/previous-page', methods=['POST'])
@token_required
def pdf_previous_page(current_user):
    """
    Volta para página anterior do PDF
    Body: { "presentation_code": str }
    """
    from app.models.presentation import PresentationSession
    from app import db
    import json
    
    data = request.get_json()
    presentation_code = data.get('presentation_code')
    
    if not presentation_code:
        return jsonify({'success': False, 'error': 'Código da apresentação necessário'}), 400
    
    session = PresentationSession.query.filter_by(code=presentation_code).first()
    if not session or session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Apresentação não encontrada'}), 404
    
    # Obter current_content
    # Coluna db.JSON já retorna dict, não precisa de json.loads
    content = dict(session.current_content) if session.current_content else {}
    
    # Decrementar página (mínimo 1)
    current_page = content.get('pdf_page', 1)
    content['pdf_page'] = max(1, current_page - 1)
    
    # Atualizar timestamp para forçar polling refresh
    content['timestamp'] = datetime.utcnow().isoformat()
    
    # Salvar
    from sqlalchemy.orm.attributes import flag_modified
    session.current_content = content
    flag_modified(session, "current_content") # Forçar detecção de mudança
    db.session.commit()
    
    return jsonify({'success': True, 'page': content['pdf_page']})


@ai_bp.route('/pdf/goto-page', methods=['POST'])
@token_required
def pdf_goto_page(current_user):
    """
    Vai para página específica do PDF
    Body: { "presentation_code": str, "page": int }
    """
    from app.models.presentation import PresentationSession
    from app import db
    import json
    
    data = request.get_json()
    presentation_code = data.get('presentation_code')
    page = data.get('page')
    
    if not presentation_code or not page:
        return jsonify({'success': False, 'error': 'Código da apresentação e número da página necessários'}), 400
    
    session = PresentationSession.query.filter_by(code=presentation_code).first()
    if not session or session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Apresentação não encontrada'}), 404
    
    # Obter current_content
    # Coluna db.JSON já retorna dict
    content = dict(session.current_content) if session.current_content else {}
    
    # Ir para página (mínimo 1)
    content['pdf_page'] = max(1, int(page))
    
    # Atualizar timestamp para forçar polling refresh
    content['timestamp'] = datetime.utcnow().isoformat()
    
    # Salvar
    from sqlalchemy.orm.attributes import flag_modified
    session.current_content = content
    flag_modified(session, "current_content")
    db.session.commit()
    
    return jsonify({'success': True, 'page': content['pdf_page']})


@ai_bp.route('/pdf/zoom', methods=['POST'])
@token_required
def pdf_zoom(current_user):
    """
    Controla zoom do PDF
    Body: { "presentation_code": str, "zoom": str }
    zoom pode ser: "in" (aumentar), "out" (diminuir), "auto", "page-fit", "page-width", "page-actual"
    ou um número como "150" para 150%
    """
    from app.models.presentation import PresentationSession
    from app import db
    import json
    
    data = request.get_json()
    presentation_code = data.get('presentation_code')
    zoom_action = data.get('zoom')
    
    if not presentation_code or not zoom_action:
        return jsonify({'success': False, 'error': 'Código da apresentação e ação de zoom necessários'}), 400
    
    session = PresentationSession.query.filter_by(code=presentation_code).first()
    if not session or session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Apresentação não encontrada'}), 404
    
    # Obter current_content
    # Coluna db.JSON já retorna dict
    content = dict(session.current_content) if session.current_content else {}
    
    # Processar ação de zoom
    if zoom_action == 'in':
        # Aumentar zoom (de 100 para 125, 150, 175, 200, etc)
        current_zoom = content.get('pdf_zoom', 'auto')
        if current_zoom.isdigit():
            new_zoom = min(400, int(current_zoom) + 25)  # Máximo 400%
            content['pdf_zoom'] = str(new_zoom)
        else:
            content['pdf_zoom'] = '125'  # Começar em 125%
    elif zoom_action == 'out':
        # Diminuir zoom
        current_zoom = content.get('pdf_zoom', 'auto')
        if current_zoom.isdigit():
            new_zoom = max(50, int(current_zoom) - 25)  # Mínimo 50%
            content['pdf_zoom'] = str(new_zoom)
        else:
            content['pdf_zoom'] = '75'  # Começar em 75%
    else:
        # Zoom direto (auto, page-fit, page-width, page-actual, ou número)
        content['pdf_zoom'] = zoom_action
    
    # Atualizar timestamp para forçar polling refresh
    content['timestamp'] = datetime.utcnow().isoformat()
    
    # Salvar
    from sqlalchemy.orm.attributes import flag_modified
    session.current_content = content
    flag_modified(session, "current_content")
    db.session.commit()
    
    return jsonify({'success': True, 'zoom': content['pdf_zoom']})


