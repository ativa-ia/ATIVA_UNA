"""
Rotas para gerenciamento de documentos da tabela Supabase
Busca e organiza chunks de documentos armazenados como embeddings
"""
from flask import Blueprint, request, jsonify
from app.middleware.auth_middleware import token_required
from supabase import create_client
import os
import logging

logger = logging.getLogger(__name__)

document_bp = Blueprint('document', __name__)

# Inicializar cliente Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY') or os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Supabase credentials not configured!")
    supabase = None
else:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


@document_bp.route('/retrieve', methods=['GET'])
def retrieve_document():
    """
    Busca documento completo da tabela documents do Supabase
    e organiza os chunks em seções ordenadas
    
    Query Parameters:
        - classroom_id (required): ID da sala/disciplina
        - filename (optional): Nome do arquivo, padrão 'GUIA TURBO'
    
    Returns:
        JSON com estrutura do documento organizado em seções
    """
    try:
        # Validar configuração do Supabase
        if not supabase:
            return jsonify({
                'success': False,
                'error': 'Supabase não configurado'
            }), 500
        
        # Obter parâmetros
        classroom_id = request.args.get('classroom_id')
        filename = request.args.get('filename', 'GUIA TURBO')
        
        if not classroom_id:
            return jsonify({
                'success': False,
                'error': 'classroom_id é obrigatório'
            }), 400
        
        logger.info(f"Buscando documento: {filename} para classroom: {classroom_id}")
        
        # Buscar chunks do documento no Supabase
        # A tabela 'documents' armazena chunks com metadata
        response = supabase.table('documents') \
            .select('id, content, metadata') \
            .eq('metadata->>classroom_id', classroom_id) \
            .eq('metadata->>source_filename', filename) \
            .order('id', desc=False) \
            .execute()
        
        if not response.data:
            logger.warning(f"Documento não encontrado: {filename} em {classroom_id}")
            return jsonify({
                'success': False,
                'error': f'Documento "{filename}" não encontrado para classroom_id "{classroom_id}"'
            }), 404
        
        chunks = response.data
        logger.info(f"Encontrados {len(chunks)} chunks do documento")
        
        # Organizar chunks em seções
        # Cada chunk que começa com '##' é uma nova seção
        sections = []
        current_section = None
        section_counter = 0
        
        for chunk in chunks:
            content = chunk.get('content', '')
            
            # Verificar se é início de nova seção
            if content.strip().startswith('##'):
                # Salvar seção anterior se existir
                if current_section:
                    sections.append(current_section)
                
                # Extrair título da seção (remove '##' e espaços)
                title_line = content.split('\n')[0]
                title = title_line.replace('##', '').strip()
                
                section_counter += 1
                current_section = {
                    'section_id': section_counter,
                    'title': title,
                    'content': content.strip(),
                    'metadata': chunk.get('metadata', {})
                }
            else:
                # Adicionar conteúdo à seção atual
                if current_section:
                    current_section['content'] += '\n\n' + content.strip()
                else:
                    # Se não há seção ainda, criar uma seção inicial
                    section_counter += 1
                    current_section = {
                        'section_id': section_counter,
                        'title': 'Introdução',
                        'content': content.strip(),
                        'metadata': chunk.get('metadata', {})
                    }
        
        # Adicionar última seção
        if current_section:
            sections.append(current_section)
        
        # Retornar documento organizado
        document = {
            'filename': filename,
            'classroom_id': classroom_id,
            'total_sections': len(sections),
            'total_chunks': len(chunks),
            'sections': sections
        }
        
        logger.info(f"Documento organizado com {len(sections)} seções")
        
        return jsonify({
            'success': True,
            'document': document
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao buscar documento: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@document_bp.route('/list', methods=['GET'])
def list_documents():
    """
    Lista todos os documentos disponíveis para um classroom_id
    
    Query Parameters:
        - classroom_id (required): ID da sala/disciplina
    
    Returns:
        JSON com lista de nomes de arquivos únicos
    """
    try:
        if not supabase:
            return jsonify({
                'success': False,
                'error': 'Supabase não configurado'
            }), 500
        
        classroom_id = request.args.get('classroom_id')
        
        if not classroom_id:
            return jsonify({
                'success': False,
                'error': 'classroom_id é obrigatório'
            }), 400
        
        # Buscar todos os documentos (filenames únicos)
        response = supabase.table('documents') \
            .select('metadata') \
            .eq('metadata->>classroom_id', classroom_id) \
            .execute()
        
        if not response.data:
            return jsonify({
                'success': True,
                'documents': []
            }), 200
        
        # Extrair filenames únicos
        filenames = set()
        for item in response.data:
            metadata = item.get('metadata', {})
            filename = metadata.get('source_filename')
            if filename:
                filenames.add(filename)
        
        return jsonify({
            'success': True,
            'classroom_id': classroom_id,
            'documents': sorted(list(filenames))
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao listar documentos: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@document_bp.route('/send_to_presentation', methods=['POST'])
@token_required
def send_to_presentation(current_user):
    """
    Busca documento da temp_documents e envia para apresentação
    
    Body JSON:
        - document_id (required): UUID do documento na temp_documents
        - presentation_code (required): Código da apresentação ativa
    
    Returns:
        JSON com confirmação de envio
    """
    try:
        if not supabase:
            return jsonify({
                'success': False,
                'error': 'Supabase não configurado'
            }), 500
        
        data = request.get_json()
        document_id = data.get('document_id')
        presentation_code = data.get('presentation_code')
        
        if not document_id or not presentation_code:
            return jsonify({
                'success': False,
                'error': 'document_id e presentation_code são obrigatórios'
            }), 400
        
        logger.info(f"Buscando documento {document_id} para enviar para apresentação {presentation_code}")
        
        # Buscar documento da temp_documents
        response = supabase.table('temp_documents') \
            .select('*') \
            .eq('id', document_id) \
            .execute()
        
        if not response.data or len(response.data) == 0:
            return jsonify({
                'success': False,
                'error': f'Documento {document_id} não encontrado'
            }), 404
        
        temp_doc = response.data[0]
        document_data = temp_doc.get('document_data', {})
        
        logger.info(f"Documento encontrado: {temp_doc.get('filename')}")
        
        # Importar modelo de apresentação
        from app.models.presentation import PresentationSession
        from app import db
        from datetime import datetime
        
        # Buscar sessão de apresentação
        session = PresentationSession.query.filter_by(code=presentation_code).first()
        
        if not session:
            return jsonify({
                'success': False,
                'error': f'Apresentação com código {presentation_code} não encontrada'
            }), 404
        
        if session.teacher_id != current_user.id:
            return jsonify({
                'success': False,
                'error': 'Não autorizado'
            }), 403
        
        if session.status != 'active':
            return jsonify({
                'success': False,
                'error': 'Apresentação não está ativa'
            }), 400
        
        # Atualizar conteúdo da apresentação
        session.current_content = {
            'type': 'document',
            'data': document_data,
            'timestamp': datetime.utcnow().isoformat()
        }
        db.session.commit()
        
        # Emitir via WebSocket
        try:
            from app.services.websocket_service import emit_presentation_content
            emit_presentation_content(presentation_code, session.current_content)
            logger.info(f"Documento enviado via WebSocket para apresentação {presentation_code}")
        except Exception as e:
            logger.error(f"Erro ao emitir WebSocket: {e}")
        
        return jsonify({
            'success': True,
            'message': f'Documento "{temp_doc.get("filename")}" enviado para apresentação',
            'document': {
                'filename': temp_doc.get('filename'),
                'total_chunks': document_data.get('total_chunks', 0),
                'total_sections': document_data.get('total_sections', 0)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Erro ao enviar documento para apresentação: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

