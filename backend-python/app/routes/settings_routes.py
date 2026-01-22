from flask import Blueprint, request, jsonify
from app import db
from app.models.system_setting import SystemSetting
from app.middleware.admin_middleware import super_admin_required

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/public', methods=['GET'])
def get_public_settings():
    """Retorna configurações públicas (sem auth)"""
    settings = SystemSetting.query.filter_by(is_public=True).all()
    # Converte para um dicionário simples key: value para fácil uso no frontend
    settings_dict = {s.key: s.value for s in settings}
    return jsonify({
        'success': True,
        'settings': settings_dict
    }), 200

@settings_bp.route('/', methods=['GET'])
@super_admin_required
def get_all_settings(current_user):
    """Retorna todas as configurações (Super Admin)"""
    settings = SystemSetting.query.all()
    return jsonify({
        'success': True,
        'settings': [s.to_dict() for s in settings]
    }), 200

@settings_bp.route('/', methods=['POST'])
@super_admin_required
def update_setting(current_user):
    """Cria ou atualiza uma configuração (Super Admin)"""
    data = request.get_json()
    
    key = data.get('key')
    value = data.get('value')
    description = data.get('description')
    is_public = data.get('is_public', False)
    
    if not key or value is None:
        return jsonify({'success': False, 'message': 'Chave e valor são obrigatórios'}), 400
        
    setting = SystemSetting.query.get(key)
    
    try:
        if setting:
            setting.value = value
            if description: setting.description = description
            setting.is_public = is_public
        else:
            setting = SystemSetting(key=key, value=value, description=description, is_public=is_public)
            db.session.add(setting)
            
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Configuração salva com sucesso',
            'setting': setting.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
