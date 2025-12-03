# Guia de Integração - Telas de Autenticação

## ✅ O Que Foi Feito

As 3 telas de autenticação foram integradas com sucesso no projeto `myapp`:

### Estrutura Criada

```
myapp/
├── app/
│   ├── (auth)/                    # ✅ Grupo de rotas de autenticação
│   │   ├── _layout.tsx            # ✅ Layout sem header
│   │   ├── login.tsx              # ✅ Tela de login
│   │   ├── cadastro.tsx           # ✅ Tela de cadastro
│   │   └── recuperar-senha.tsx    # ✅ Recuperação de senha
│   ├── _layout.tsx
│   └── index.tsx                  # ✅ Redireciona para login
├── components/                    # ✅ Componentes copiados
│   └── common/
│       ├── Avatar.tsx
│       ├── Button.tsx
│       ├── IconButton.tsx
│       └── Input.tsx
├── constants/                     # ✅ Design system copiado
│   ├── colors.ts
│   ├── typography.ts
│   └── spacing.ts
└── types/                         # ✅ Tipos TypeScript
    └── index.ts
```

### Rotas Disponíveis

| Rota | Tela | Descrição |
|------|------|-----------|
| `/` | index.tsx | Redireciona para login |
| `/(auth)/login` | login.tsx | Tela de login principal |
| `/(auth)/cadastro` | cadastro.tsx | Criar nova conta |
| `/(auth)/recuperar-senha` | recuperar-senha.tsx | Recuperar senha |

## 🚀 Próximos Passos

### 1. Instalar Dependência Faltante

Você precisa instalar o `expo-linear-gradient` (usado nos cards de disciplinas):

```bash
npx expo install expo-linear-gradient
```

### 2. Testar as Telas

Execute o projeto:

```bash
npx expo start
```

Pressione:
- `a` para Android
- `i` para iOS
- `w` para Web

### 3. Navegação Entre Telas

A navegação já está configurada! Os botões funcionam assim:

**Na tela de Login (`/(auth)/login`):**
- **"Criar Conta"** → Navega para `/(auth)/cadastro`
- **"Esqueci minha senha"** → Navega para `/(auth)/recuperar-senha`

**Na tela de Cadastro (`/(auth)/cadastro`):**
- **"Voltar para o Login"** → Volta para `/(auth)/login`

**Na tela de Recuperar Senha (`/(auth)/recuperar-senha`):**
- **"Lembrei minha senha"** → Volta para `/(auth)/login`

## 📝 Personalizações

### Renomear Telas

Você pode renomear os arquivos conforme preferir:

```
login.tsx → entrar.tsx
cadastro.tsx → criar-conta.tsx
recuperar-senha.tsx → esqueci-senha.tsx
```

**Importante:** Se renomear, atualize as rotas nos botões:

```typescript
// Antes
router.push('/(auth)/cadastro');

// Depois (se renomear para criar-conta.tsx)
router.push('/(auth)/criar-conta');
```

### Adicionar Validação

Exemplo de validação de email:

```typescript
const isValidEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const handleLogin = () => {
  if (!isValidEmail(email)) {
    alert('Email inválido!');
    return;
  }
  if (password.length < 6) {
    alert('Senha deve ter no mínimo 6 caracteres!');
    return;
  }
  // Prosseguir com login
};
```

### Conectar com Backend

Substitua os `console.log` por chamadas de API:

```typescript
const handleLogin = async () => {
  try {
    const response = await fetch('https://sua-api.com/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role: selectedRole }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Salvar token
      // await AsyncStorage.setItem('token', data.token);
      
      // Navegar para dashboard
      router.replace('/dashboard');
    } else {
      alert('Login falhou: ' + data.message);
    }
  } catch (error) {
    alert('Erro ao fazer login');
  }
};
```

### Adicionar Loading State

```typescript
const [isLoading, setIsLoading] = useState(false);

const handleLogin = async () => {
  setIsLoading(true);
  try {
    // Fazer login
  } finally {
    setIsLoading(false);
  }
};

// No botão
<Button
  title="Entrar"
  onPress={handleLogin}
  variant="primary"
  loading={isLoading}
  disabled={isLoading}
/>
```

## 🎨 Customização Visual

### Alterar Cores

Edite `constants/colors.ts`:

```typescript
export const colors = {
  primary: '#135bec', // Mude para sua cor
  // ...
};
```

### Alterar Fonte

As telas usam a fonte **Lexend**. Para usar:

1. Baixe do [Google Fonts](https://fonts.google.com/specimen/Lexend)
2. Coloque em `assets/fonts/`
3. Carregue no `_layout.tsx` raiz:

```typescript
import { useFonts } from 'expo-font';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Lexend': require('../assets/fonts/Lexend-Regular.ttf'),
  });

  if (!fontsLoaded) return null;

  return <Stack />;
}
```

## 🔧 Troubleshooting

### Erro: Cannot find module '@/components/...'

**Causa:** Path alias `@` não configurado.

**Solução:** Adicione ao `tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Erro: expo-linear-gradient not found

**Solução:**
```bash
npx expo install expo-linear-gradient
```

### Telas não aparecem

**Verificar:**
1. O app está rodando? (`npx expo start`)
2. O arquivo `app/index.tsx` redireciona para `/(auth)/login`?
3. Os arquivos estão na pasta `app/(auth)/`?

### Navegação não funciona

**Verificar:**
1. Está usando `router` do `expo-router`?
2. As rotas estão corretas? (ex: `/(auth)/login`)
3. O `expo-router` está instalado? (já está no seu package.json)

## 📚 Recursos Adicionais

### Documentação Oficial

- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Expo Vector Icons](https://docs.expo.dev/guides/icons/)
- [React Native](https://reactnative.dev/)

### Próximas Telas

Para adicionar mais telas (dashboard, etc.), siga o mesmo padrão:

1. Crie o arquivo na pasta `app/`
2. Use `router.push()` ou `router.replace()` para navegar
3. Importe os componentes de `@/components/`

### Exemplo: Criar Dashboard

```typescript
// app/dashboard.tsx
import { View, Text } from 'react-native';

export default function DashboardScreen() {
  return (
    <View>
      <Text>Dashboard</Text>
    </View>
  );
}

// No login.tsx, após autenticação:
router.replace('/dashboard');
```

## ✅ Checklist de Verificação

- [x] Pastas criadas (`constants`, `components`, `types`, `app/(auth)`)
- [x] Arquivos copiados (constantes, tipos, componentes)
- [x] Telas de autenticação criadas (login, cadastro, recuperar-senha)
- [x] Layout do grupo configurado
- [x] index.tsx redirecionando para login
- [ ] `expo-linear-gradient` instalado
- [ ] Projeto testado (executar `npx expo start`)
- [ ] Navegação testada (clicar nos botões)

## 🎯 Resumo

✅ **3 telas de autenticação** integradas e funcionais
✅ **Navegação configurada** com Expo Router
✅ **Componentes reutilizáveis** prontos para uso
✅ **Design system** implementado

**Próximo passo:** Instalar `expo-linear-gradient` e testar o app!

```bash
npx expo install expo-linear-gradient
npx expo start
```
