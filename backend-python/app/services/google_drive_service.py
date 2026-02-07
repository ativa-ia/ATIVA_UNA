from googleapiclient.discovery import build
from google.oauth2 import service_account
from googleapiclient.http import MediaIoBaseUpload
import os

class GoogleDriveService:
    SCOPES = ['https://www.googleapis.com/auth/drive']
    
    def __init__(self):
        self.creds = None
        self.service = None
        self.folder_id = os.getenv('GOOGLE_DRIVE_FOLDER_ID')
        if not self.folder_id:
            raise ValueError("GOOGLE_DRIVE_FOLDER_ID not set in .env")
        self._authenticate()

    def _authenticate(self):
        # 1. Tentar Autenticação via Variável de Ambiente (OAuth Token Raw) - PRODUÇÃO
        json_token = os.getenv('GOOGLE_TOKEN_JSON')
        if json_token:
            try:
                import json
                from google.oauth2.credentials import Credentials
                info = json.loads(json_token)
                # O token.json já contém os escopos. Passar scopes novamente pode causar 'invalid_scope' se houver divergência.
                # Vamos passar None para usar o que está no arquivo, ou apenas info.
                self.creds = Credentials.from_authorized_user_info(info)
                if self.creds.expired and self.creds.refresh_token:
                    from google.auth.transport.requests import Request
                    self.creds.refresh(Request())
                self.service = build('drive', 'v3', credentials=self.creds)
                print("Autenticado via GOOGLE_TOKEN_JSON (Env Var)")
                return
            except Exception as e:
                print(f"Erro ao carregar token da ENV: {e}")

        # 2. Autenticação via Arquivo (token.json) - DESENVOLVIMENTO
        token_path = os.getenv('GOOGLE_TOKEN_JSON_PATH', 'token.json')
        if not os.path.exists(token_path):
             token_path_root = os.path.join(os.getcwd(), 'token.json')
             if os.path.exists(token_path_root):
                 token_path = token_path_root

        if os.path.exists(token_path):
            try:
                from google.oauth2.credentials import Credentials
                # Mesma lógica: token já contém scopes, não forçar override
                self.creds = Credentials.from_authorized_user_file(token_path)
                if self.creds.expired and self.creds.refresh_token:
                    from google.auth.transport.requests import Request
                    self.creds.refresh(Request())
                self.service = build('drive', 'v3', credentials=self.creds)
                print(f"Autenticado via Arquivo OAuth: {token_path}")
                return
            except Exception as e:
                print(f"Erro ao carregar arquivo token.json: {e}")

        # 2. Fallback: Variável de Ambiente (Service Account JSON text)
        json_creds = os.getenv('GOOGLE_CREDENTIALS_JSON')
        if json_creds:
            try:
                import json
                info = json.loads(json_creds)
                from google.oauth2 import service_account
                self.creds = service_account.Credentials.from_service_account_info(
                    info, scopes=self.SCOPES)
                self.service = build('drive', 'v3', credentials=self.creds)
                print("Autenticado via GOOGLE_CREDENTIALS_JSON (Service Account)")
                return
            except Exception as e:
                print(f"Erro ao carregar credenciais da ENV: {e}")

        # 3. Fallback: Arquivo Service Account (credentials.json)
        creds_file = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', 'credentials.json')
        
        if os.path.exists(creds_file):
            from google.oauth2 import service_account
            self.creds = service_account.Credentials.from_service_account_file(
                creds_file, scopes=self.SCOPES)
            self.service = build('drive', 'v3', credentials=self.creds)
            print(f"Autenticado via Arquivo Service Account: {creds_file}")
        else:
             raise FileNotFoundError("Nenhuma credencial encontrada (token.json ou credentials.json).")

    def upload_file(self, file_stream, filename, mime_type):
        """
        Uploads a file to Google Drive and makes it public.
        Returns the file object with id, webViewLink, webContentLink.
        """
        file_metadata = {
            'name': filename,
            'parents': [self.folder_id]
        }
        # MediaIoBaseUpload espera um stream de bytes.
        # file_stream do Flask é um FileStorage, stream property ou ele mesmo atua como stream.
        media = MediaIoBaseUpload(file_stream, mimetype=mime_type, resumable=True)
        
        file = self.service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink, webContentLink'
        ).execute()
        
        # Permitir acesso público
        self.service.permissions().create(
            fileId=file.get('id'),
            body={'role': 'reader', 'type': 'anyone'}
        ).execute()

        return file
