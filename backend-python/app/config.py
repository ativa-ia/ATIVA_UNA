import os
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()


class Config:
    """Configuração base"""
    SECRET_KEY = os.getenv('JWT_SECRET', 'dev_secret_key')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # CORS
    CORS_HEADERS = 'Content-Type'
    
    # JWT
    JWT_SECRET = os.getenv('JWT_SECRET', 'dev_secret_key')
    JWT_EXPIRATION_DAYS = 7


class DevelopmentConfig(Config):
    """Configuração de desenvolvimento"""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///database.sqlite')
    SQLALCHEMY_ECHO = True  # Log de queries SQL


class ProductionConfig(Config):
    """Configuração de produção"""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    SQLALCHEMY_ECHO = False


class TestConfig(Config):
    """Configuração de testes"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///test.sqlite'


# Dicionário de configurações
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'test': TestConfig,
    'default': DevelopmentConfig
}
