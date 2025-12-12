from app import create_app, db
from app.models.gamification import Badge

app = create_app()

with app.app_context():
    # Criar tabelas se não existirem
    db.create_all()

    # Seed badges
    Badge.seed_badges()

    print("Tabelas de gamificação criadas e badges semeados com sucesso!")</content>
<parameter name="filePath">c:\Users\admin\Desktop\ativaIA\backend-python\scripts\setup_gamification.py