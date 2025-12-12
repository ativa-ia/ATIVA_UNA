"""
Migration script to add gamification fields to quiz_responses table
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from sqlalchemy import text

def migrate():
    """Add points and time_taken columns to quiz_responses"""
    app = create_app()
    
    with app.app_context():
        try:
            # Check if columns already exist (PostgreSQL)
            result = db.session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='quiz_responses'
            """))
            columns = [row[0] for row in result]
            
            # Add points column if it doesn't exist
            if 'points' not in columns:
                print("Adding 'points' column to quiz_responses...")
                db.session.execute(text(
                    "ALTER TABLE quiz_responses ADD COLUMN points INTEGER DEFAULT 0"
                ))
                print("✓ Added 'points' column")
            else:
                print("'points' column already exists")
            
            # Add time_taken column if it doesn't exist
            if 'time_taken' not in columns:
                print("Adding 'time_taken' column to quiz_responses...")
                db.session.execute(text(
                    "ALTER TABLE quiz_responses ADD COLUMN time_taken INTEGER DEFAULT 0"
                ))
                print("✓ Added 'time_taken' column")
            else:
                print("'time_taken' column already exists")
            
            db.session.commit()
            print("\n✅ Migration completed successfully!")
            
        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            db.session.rollback()
            raise

if __name__ == '__main__':
    migrate()
