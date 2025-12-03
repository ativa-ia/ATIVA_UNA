# Backend Python - Assistente 360

Backend de autenticação em Python usando Flask para o projeto Assistente 360.

## 🚀 Tecnologias

- **Flask** - Framework web leve e escalável
- **SQLAlchemy** - ORM para banco de dados
- **SQLite** - Banco de dados (desenvolvimento)
- **JWT** - Autenticação com tokens
- **bcrypt** - Hash seguro de senhas
- **Marshmallow** - Validação de dados

## 📁 Estrutura do Projeto

```
backend-python/
├── app/
│   ├── __init__.py          # Factory da aplicação Flask
│   ├── config.py            # Configurações
│   ├── models/              # Modelos de dados
│   ├── controllers/         # Lógica de negócio
│   ├── routes/              # Rotas/Blueprints
│   ├── middleware/          # Middlewares
│   ├── schemas/             # Validação de dados
│   └── utils/               # Utilitários
├── .env                     # Variáveis de ambiente
├── requirements.txt         # Dependências
└── run.py                   # Entry point
```

## 🔧 Instalação

### 1. Criar ambiente virtual

```bash
python -m venv venv
```

### 2. Ativar ambiente virtual

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 3. Instalar dependências

```bash
pip install -r requirements.txt
```

### 4. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e ajuste as configurações:

```bash
copy .env.example .env
```

## ▶️ Executar

```bash
python run.py
```

O servidor estará disponível em: `http://localhost:3000`

## 📚 API Endpoints

### Autenticação

#### Registro
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "senha123",
  "role": "student",
  "name": "Nome do Usuário"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "senha123"
}
```

#### Obter dados do usuário (requer autenticação)
```http
GET /api/auth/me
Authorization: Bearer {token}
```

#### Recuperação de senha
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "usuario@example.com"
}
```

## 🔐 Autenticação

O backend usa JWT (JSON Web Tokens) para autenticação. Após login ou registro bem-sucedido, você receberá um token que deve ser enviado no header `Authorization` das requisições protegidas:

```
Authorization: Bearer {seu_token_aqui}
```

## 🎯 Roles de Usuário

- `student` - Estudante
- `teacher` - Professor

## 📱 Integração com Frontend

O backend é 100% compatível com o frontend React Native existente. Basta atualizar a URL da API no arquivo `services/api.ts`:

```typescript
const API_URL = 'http://localhost:3000/api';
```

## 🔄 Migração do Node.js

Este backend Python substitui o backend Node.js anterior, mantendo:
- ✅ Mesmas rotas e endpoints
- ✅ Mesmos formatos de request/response
- ✅ Mesmo sistema de autenticação JWT
- ✅ Mesma estrutura de banco de dados

## 🚀 Preparado para Crescimento

A arquitetura modular facilita a adição de novos recursos:

### Adicionar novo módulo (exemplo: cursos)

1. Criar modelo em `app/models/course.py`
2. Criar controller em `app/controllers/course_controller.py`
3. Criar rotas em `app/routes/course_routes.py`
4. Registrar blueprint em `app/__init__.py`

## 🧪 Testes

Para testar os endpoints, você pode usar:
- **Postman** ou **Insomnia** para testes manuais
- **curl** para testes via linha de comando
- O próprio app React Native

### Exemplo com curl:

```bash
# Registro
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"teste@example.com\",\"password\":\"senha123\",\"role\":\"student\",\"name\":\"Teste\"}"

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"teste@example.com\",\"password\":\"senha123\"}"
```

## 📝 Variáveis de Ambiente

- `FLASK_ENV` - Ambiente (development, production, test)
- `PORT` - Porta do servidor (padrão: 3000)
- `JWT_SECRET` - Chave secreta para JWT
- `DATABASE_URL` - URL do banco de dados

## 🛠️ Desenvolvimento

### Estrutura de código

- **Models**: Definição de tabelas e lógica de dados
- **Controllers**: Lógica de negócio e processamento
- **Routes**: Definição de endpoints
- **Middleware**: Autenticação e autorização
- **Schemas**: Validação de entrada de dados
- **Utils**: Funções auxiliares

### Boas práticas implementadas

- Separação de responsabilidades (MVC)
- Validação de dados centralizada
- Tratamento de erros consistente
- Código modular e reutilizável
- Configuração por ambiente

## 📄 Licença

Este projeto faz parte do Assistente 360.
