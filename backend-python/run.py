import os
from app import create_app

app = create_app()

# Importar websocket handlers
# from app.services import websocket_service

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    
    print('\n>> Servidor rodando na porta', port)
    print(f'>> http://localhost:{port}')
    print(f'>> WebSocket habilitado\n')
    
    # print(f'>> Mode: {socketio.server.async_mode}')

    app.run(
        host='0.0.0.0',
        port=port,
        debug=True,
        use_reloader=False 
    )
