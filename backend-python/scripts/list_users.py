import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ['FLASK_ENV'] = 'production'
from app import create_app, db
from app.models.user import User

app = create_app('production')

# Senhas conhecidas (as que foram definidas no seed)
KNOWN_PASSWORDS = {
    "admin@assistente360.com": "admin123",
    "maria.silva@edu.br": "prof123",
    "joao.santos@edu.br": "prof123",
    "ana.costa@edu.br": "prof123",
    "carlos.lima@edu.br": "prof123",
    "lucas.aluno@edu.br": "aluno123",
    "julia.aluno@edu.br": "aluno123",
    "pedro.aluno@edu.br": "aluno123",
    "maria.aluno@edu.br": "aluno123",
    "rafael.aluno@edu.br": "aluno123",
}

with app.app_context():
    # Remover usuários de teste (IDs 1, 2, 3)
    print("🗑️ Removendo usuários de teste...")
    test_users = User.query.filter(User.id.in_([1, 2, 3])).all()
    for u in test_users:
        print(f"  ❌ Removendo: {u.name} ({u.email})")
        db.session.delete(u)
    db.session.commit()
    print("✅ Usuários de teste removidos!\n")
    
    # Listar usuários restantes
    users = User.query.order_by(User.id).all()
    
    print(f"{'='*100}")
    print(f"{'ID':<5} {'ROLE':<10} {'NOME':<25} {'EMAIL':<35} {'SENHA':<15}")
    print(f"{'='*100}")
    
    for u in users:
        password = KNOWN_PASSWORDS.get(u.email, "(desconhecida)")
        print(f"{u.id:<5} {u.role:<10} {u.name:<25} {u.email:<35} {password:<15}")
    
    print(f"{'='*100}")
    print(f"Total: {len(users)} usuários")
