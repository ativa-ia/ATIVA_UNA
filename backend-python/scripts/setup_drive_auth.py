import os
import pickle
import json
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

# Escopo para upload e gerenciamento de arquivos
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def authenticate():
    creds = None
    token_path = 'token.json'
    
    # 1. Tentar carregar token existente
    if os.path.exists(token_path):
        try:
            with open(token_path, 'r') as token:
                data = json.load(token)
                creds = Credentials.from_authorized_user_info(data, SCOPES)
        except Exception as e:
            print(f"Erro ao ler token existente: {e}")

    # 2. Se não houver credenciais válidas, fazer login
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Atualizando token expirado...")
            creds.refresh(Request())
        else:
            print("Iniciando novo fluxo de autenticação via Browser...")
            # Verificar se existe o arquivo client_secrets.json
            if not os.path.exists('client_secrets.json'):
                print("ERRO: Arquivo 'client_secrets.json' não encontrado.")
                print("1. Vá no Google Cloud Console > APIs & Services > Credentials")
                print("2. Crie uma Credencial do tipo 'OAuth Client ID' (Desktop App)")
                print("3. Baixe o JSON e renomeie para 'client_secrets.json' nesta pasta.")
                return

            flow = InstalledAppFlow.from_client_secrets_file(
                'client_secrets.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Salvar as credenciais para a próxima execução
        print("Salvando novas credenciais em 'token.json'...")
        with open(token_path, 'w') as token:
            token.write(creds.to_json())
            
    print("\n✅ Autenticação realizada com sucesso!")
    print(f"Token salvo em: {os.path.abspath(token_path)}")
    print("Agora o backend pode usar este arquivo para fazer uploads.")

if __name__ == '__main__':
    authenticate()
