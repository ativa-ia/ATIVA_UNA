import sys
import os
from sqlalchemy.schema import CreateTable
from sqlalchemy import create_mock_engine

# Add current directory to path
sys.path.append(os.getcwd())

# Import environment variables
from dotenv import load_dotenv
load_dotenv()

# Import db and models
from app import create_app, db
from app.models import *  # Import all models to ensure they are registered

def dump_sql(sql, *multiparams, **params):
    print(sql.compile(dialect=engine.dialect))

def generate_ddl():
    app = create_app()
    
    with app.app_context():
        # Create a mock engine to generate SQL without connecting
        global engine
        engine = create_mock_engine('postgresql://', dump_sql)
        
        print("-- Arquivo gerado automaticamente")
        print(f"-- Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("-- Banco de Dados: PostgreSQL")
        print("\n")
        
        # Collect all tables
        metadata = db.metadata
        
        # Sort tables by dependency (if possible) or just list them
        # create_all usually handles order, but with mock engine it prints individually
        
        # Manually mapped order to avoid foreign key errors when running SQL
        ordered_tables = [
            'users',
            'subjects',
            'courses',
            'classes',
            'teachings',
            'enrollments',
            'transcription_sessions',
            'transcription_checkpoints',
            'live_activities',
            'live_activity_responses',
            'ai_sessions',
            'ai_messages',
            'ai_context_files',
            # Add others if needed
        ]
        
        # Print CREATE TABLE statements
        # We iterate over metadata.tables but try to respect order
        
        tables_processed = set()
        
        # First pass: Valid tables in order
        for table_name in ordered_tables:
            if table_name in metadata.tables:
                print(f"-- Table: {table_name}")
                CreateTable(metadata.tables[table_name]).compile(engine)
                print(";\n")
                tables_processed.add(table_name)
        
        # Second pass: Any remaining tables (except removed ones)
        ignored_tables = ['grades', 'announcements', 'quizzes', 'quiz_questions', 'quiz_responses', 'quiz_reports']
        
        for table_name, table in metadata.tables.items():
            if table_name not in tables_processed and table_name not in ignored_tables:
                print(f"-- Table: {table_name}")
                CreateTable(table).compile(engine)
                print(";\n")

if __name__ == '__main__':
    from datetime import datetime
    generate_ddl()
