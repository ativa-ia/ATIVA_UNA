from app import create_app, db
from sqlalchemy import text

app = create_app()

with app.app_context():
    try:
        with db.engine.connect() as conn:
            conn.execute(text("ALTER TABLE live_activity_responses ADD COLUMN points INTEGER DEFAULT 0"))
            conn.commit()
            print("Coluna 'points' adicionada com sucesso!")
    except Exception as e:
        print(f"Erro (pode já existir): {e}")
