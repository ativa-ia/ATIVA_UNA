# Fluxo de Navegação - Telas de Autenticação

## 📱 Mapa de Navegação

```
┌─────────────────────────────────────────────────────────────┐
│                        app/index.tsx                        │
│                   (Tela Inicial do App)                     │
│                                                             │
│              Redireciona automaticamente para               │
│                      ↓                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   app/(auth)/login.tsx                      │
│                    🔐 TELA DE LOGIN                         │
│─────────────────────────────────────────────────────────────│
│  • Seleção de perfil (Aluno/Professor)                     │
│  • Campo: E-mail Institucional                             │
│  • Campo: Senha                                            │
│─────────────────────────────────────────────────────────────│
│  Botões:                                                    │
│  [Entrar] ──────────────────────────────► Dashboard (TODO) │
│  [Criar Conta] ─────────────────────────► cadastro.tsx     │
│  Link: "Esqueci minha senha" ───────────► recuperar-senha  │
└─────────────────────────────────────────────────────────────┘
                    │                    │
                    │                    │
        ┌───────────┘                    └───────────┐
        ↓                                            ↓
┌──────────────────────────┐      ┌──────────────────────────┐
│  app/(auth)/cadastro.tsx │      │ app/(auth)/              │
│  📝 TELA DE CADASTRO     │      │ recuperar-senha.tsx      │
│──────────────────────────│      │ 🔑 RECUPERAR SENHA       │
│ • E-mail Institucional   │      │──────────────────────────│
│ • Senha                  │      │ • E-mail Institucional   │
│ • Confirmar Senha        │      │──────────────────────────│
│ • Perfil (Aluno/Prof)    │      │ Botões:                  │
│──────────────────────────│      │ [Enviar Instruções]      │
│ Botões:                  │      │ Link: "Lembrei minha     │
│ [Cadastrar] ─────► TODO  │      │       senha" ────► login │
│ [Voltar] ────────► login │      └──────────────────────────┘
└──────────────────────────┘
```

## 🔄 Fluxo Detalhado

### 1. Inicialização do App

```
Usuário abre o app
    ↓
app/index.tsx carrega
    ↓
<Redirect href="/(auth)/login" />
    ↓
Usuário vê tela de login
```

### 2. Fluxo de Login

```
Usuário na tela de login
    ↓
Seleciona perfil (Aluno ou Professor)
    ↓
Preenche email e senha
    ↓
Clica em "Entrar"
    ↓
[Validação] ──► Se inválido: Mostra erro
    ↓
[Autenticação] ──► Se falhar: Mostra erro
    ↓
Se sucesso: router.replace('/dashboard')
```

### 3. Fluxo de Cadastro

```
Usuário na tela de login
    ↓
Clica em "Criar Conta"
    ↓
router.push('/(auth)/cadastro')
    ↓
Usuário preenche formulário
    ↓
Clica em "Cadastrar"
    ↓
[Validação] ──► Verifica se senhas coincidem
    ↓
[Cadastro] ──► Cria conta no backend
    ↓
Se sucesso: Pode ir para dashboard ou confirmação de email
    ↓
Clica em "Voltar": router.back() ──► Volta para login
```

### 4. Fluxo de Recuperação de Senha

```
Usuário na tela de login
    ↓
Clica em "Esqueci minha senha"
    ↓
router.push('/(auth)/recuperar-senha')
    ↓
Usuário preenche email
    ↓
Clica em "Enviar Instruções"
    ↓
[Validação] ──► Verifica email
    ↓
[Backend] ──► Envia email de recuperação
    ↓
Mostra mensagem de sucesso
    ↓
Clica em "Lembrei minha senha": router.back() ──► Volta para login
```

## 🎯 Métodos de Navegação Usados

### `router.push()`
Navega para uma nova tela, mantendo a anterior no histórico.

```typescript
router.push('/(auth)/cadastro');
// Usuário pode voltar com botão "voltar"
```

### `router.back()`
Volta para a tela anterior no histórico.

```typescript
router.back();
// Equivalente a pressionar botão "voltar" do dispositivo
```

### `router.replace()`
Substitui a tela atual (não mantém no histórico).

```typescript
router.replace('/dashboard');
// Usuário NÃO pode voltar para login com botão "voltar"
// Ideal após login bem-sucedido
```

### `<Redirect />`
Redireciona automaticamente ao carregar o componente.

```typescript
<Redirect href="/(auth)/login" />
// Usado no index.tsx para redirecionar para login
```

## 📋 Estados das Telas

### Login (login.tsx)

**Estados:**
- `selectedRole`: 'student' | 'teacher'
- `email`: string
- `password`: string

**Ações:**
- `handleLogin()`: Autentica usuário
- `handleCreateAccount()`: Navega para cadastro
- `handleForgotPassword()`: Navega para recuperação

### Cadastro (cadastro.tsx)

**Estados:**
- `selectedRole`: 'student' | 'teacher'
- `email`: string
- `password`: string
- `confirmPassword`: string

**Ações:**
- `handleRegister()`: Cria nova conta
- `handleBackToLogin()`: Volta para login

### Recuperar Senha (recuperar-senha.tsx)

**Estados:**
- `email`: string

**Ações:**
- `handleSendInstructions()`: Envia email de recuperação
- `handleRememberPassword()`: Volta para login

## 🔐 Segurança e Boas Práticas

### Validações Implementadas

✅ **Cadastro:**
- Verifica se senhas coincidem
- Mostra alert se não coincidirem

### Validações Recomendadas (TODO)

- [ ] Validar formato de email
- [ ] Validar força da senha (mínimo 8 caracteres, etc.)
- [ ] Validar email institucional (domínio específico)
- [ ] Rate limiting (limitar tentativas de login)
- [ ] Captcha para prevenir bots

### Autenticação (TODO)

```typescript
// Exemplo de fluxo completo
const handleLogin = async () => {
  // 1. Validar inputs
  if (!isValidEmail(email)) {
    alert('Email inválido');
    return;
  }

  // 2. Fazer requisição
  setIsLoading(true);
  try {
    const response = await fetch('API_URL/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role: selectedRole }),
    });

    const data = await response.json();

    // 3. Salvar token
    if (data.token) {
      await AsyncStorage.setItem('authToken', data.token);
      await AsyncStorage.setItem('userRole', selectedRole);
    }

    // 4. Navegar para dashboard
    router.replace('/dashboard');
  } catch (error) {
    alert('Erro ao fazer login');
  } finally {
    setIsLoading(false);
  }
};
```

## 🎨 Personalização por Perfil

Você pode personalizar a experiência baseado no perfil selecionado:

```typescript
// Após login bem-sucedido
if (selectedRole === 'student') {
  router.replace('/student/dashboard');
} else {
  router.replace('/teacher/dashboard');
}
```

## 📱 Estrutura de Rotas Sugerida (Futuro)

```
app/
├── (auth)/
│   ├── login.tsx
│   ├── cadastro.tsx
│   └── recuperar-senha.tsx
├── (student)/
│   ├── dashboard.tsx
│   ├── materiais.tsx
│   └── atividades.tsx
├── (teacher)/
│   ├── dashboard.tsx
│   ├── chamada.tsx
│   └── materiais.tsx
└── index.tsx
```

## ✅ Checklist de Funcionalidades

### Implementado ✅
- [x] Navegação entre login, cadastro e recuperação
- [x] Seleção de perfil (Aluno/Professor)
- [x] Inputs com validação básica
- [x] Botões funcionais
- [x] Design responsivo
- [x] Dark mode

### Próximos Passos 📝
- [ ] Validação de formulários
- [ ] Integração com backend
- [ ] Armazenamento de token
- [ ] Loading states
- [ ] Mensagens de erro/sucesso
- [ ] Animações de transição
- [ ] Testes automatizados
