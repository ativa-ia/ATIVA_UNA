import os
from app import create_app, socketio

app = create_app()

# Importar websocket handlers
from app.services import websocket_service

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    
    print('\n>> Servidor rodando na porta', port)
    print(f'>> http://localhost:{port}')
    print(f'>> WebSocket habilitado\n')
    
    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        debug=True,
        allow_unsafe_werkzeug=True
    )
