import traceback
from app import create_app
from app.models.admin_user import AdminUser
import datetime
from app import db
from app.models.audit_log import AuditLog
from app.utils.admin_jwt_utils import generate_admin_token

app = create_app()
app.config['TESTING'] = True
app.config['PROPAGATE_EXCEPTIONS'] = True

with app.app_context():
    admin = AdminUser.query.first()
    if not admin:
        print("No admin user found in DB!")
    else:
        print(f"Found admin: {admin.email}")
        try:
            admin.last_login_at = datetime.datetime.utcnow()
            
            AuditLog.log_action(
                admin_user_id=admin.id,
                action='LOGIN',
                ip_address='127.0.0.1',
                user_agent='test'
            )
            db.session.commit()
            
            token = generate_admin_token(admin)
            
            d = admin.to_dict()
            print("Success! Token generated")
        except Exception as e:
            traceback.print_exc()
