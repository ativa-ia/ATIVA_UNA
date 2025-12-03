import os
from app import create_app

# Criar aplicação
app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    
    print('\n>> Servidor rodando na porta', port)
    print(f'>> http://localhost:{port}')
    print(f'>> Documentacao: http://localhost:{port}/api/auth\n')
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=True
    )
