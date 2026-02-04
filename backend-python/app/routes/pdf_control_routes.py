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
    
    session = PresentationSession.query.filter_by(code=presentation_code).first()
    if not session or session.teacher_id != current_user.id:
        return jsonify({'success': False, 'error': 'Apresentação não encontrada'}), 404
    
    # Obter current_content
    content = json.loads(session.current_content) if session.current_content else {}
    
    # Incrementar página
    current_page = content.get('pdf_page', 1)
    content['pdf_page'] = current_page + 1
    
    # Salvar
    session.current_content = json.dumps(content)
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
    content = json.loads(session.current_content) if session.current_content else {}
    
    # Decrementar página (mínimo 1)
    current_page = content.get('pdf_page', 1)
    content['pdf_page'] = max(1, current_page - 1)
    
    # Salvar
    session.current_content = json.dumps(content)
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
    content = json.loads(session.current_content) if session.current_content else {}
    
    # Ir para página (mínimo 1)
    content['pdf_page'] = max(1, int(page))
    
    # Salvar
    session.current_content = json.dumps(content)
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
    content = json.loads(session.current_content) if session.current_content else {}
    
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
    
    # Salvar
    session.current_content = json.dumps(content)
    db.session.commit()
    
    return jsonify({'success': True, 'zoom': content['pdf_zoom']})


