# ATIVA IA - Documentacao do App (Mobile/Web)

Aplicativo multi-perfil (Aluno, Professor, Admin) criado com Expo Router. O app integra autenticacao, atividades ao vivo, transcricao com IA, apresentacao em tempo real e distribuicao de materiais.

## Para quem e este documento

- Pessoas nao tecnicas: entender o que o app faz e como os usuarios interagem
- Pessoas tecnicas: entender arquitetura, fluxos, rotas, servicos e configuracao

## Visao geral do produto

O ATIVA IA conecta salas de aula com IA e recursos em tempo real.

- Aluno: acessa disciplinas, materiais, atividades e quizzes ao vivo
- Professor: transcreve aula, gera resumo/quiz, controla apresentacao e distribui material
- Admin: gerencia usuarios, disciplinas e configuracoes do sistema

## Jornada do usuario (resumo executivo)

1) Acesso: login ou acesso rapido (evento)
2) Direcionamento por perfil: aluno, professor ou admin
3) Aulas e conteudo:
   - aluno ve materiais e atividades, responde ao vivo
   - professor transcreve, gera conteudo com IA e envia para a apresentacao
4) Resultados: quizzes e relatorios ao vivo, rankings e podium

## Arquitetura (alto nivel)

- Frontend: Expo + Expo Router (rotas baseadas em arquivos)
- Persistencia local: AsyncStorage (token e role)
- Integracoes:
  - API principal (backend) via REST
  - Supabase Storage para upload intermediario
  - N8N Webhook para processamento de texto e transcricao
  - Apresentacao em tempo real (polling) e controle de midia

## Estrutura do projeto (mapa rapido)

app/
- _layout.tsx: stack global e configuracao de layout
- index.tsx: bootstrap de autenticacao e redirecionamento por role
- presentation.tsx: tela de exibicao (segunda tela)
- (auth)/: login, cadastro e recuperar senha
- (student)/: dashboard, materiais, atividades, notificacoes, live-activity, live-quiz
- (teacher)/: dashboard, transcricao, base de conhecimento, upload material, resultados, atividades ativas
- (admin)/: dashboard e acoes administrativas

components/
- common/: botoes, inputs, avatar
- navigation/: header e bottom nav
- presentation/: slides, pdf viewer, controles de transmissao
- quiz/: graficos e visualizacoes
- modals/: confirmacoes e entradas

services/
- api.ts: endpoints principais (auth, subjects, activities, materials, admin, etc.)
- presentation.ts: gerenciamento de apresentacao
- quiz.ts: quizzes e relatorios
- ai.ts: chat e sessoes de IA
- n8n.ts: transcricao e processamento de texto
- supabase.ts: cliente de storage

constants/
- colors.ts, spacing.ts, typography.ts: design system

hooks/
- usePresentationPolling.ts: polling da apresentacao
- useWebSocket.ts: socket (ranking em tempo real)

## Fluxos principais (detalhados)

### Autenticacao e roteamento

- [app/index.tsx] valida token e direciona para o dashboard correto
- [app/(auth)/login.tsx] login rapido (evento)
- [app/(auth)/login_original.tsx] login com senha
- [services/api.ts] funcoes de auth e persistencia do token

### Aluno

- Dashboard: lista disciplinas e atividade ao vivo
- Materiais: filtro por disciplina e abertura de arquivos (PDF e links)
- Atividades: historico, exportacao PDF e revisao
- Atividades ao vivo: quiz e pergunta aberta com timer

Arquivos principais:
- app/(student)/dashboard.tsx
- app/(student)/materials.tsx
- app/(student)/activities.tsx
- app/(student)/live-activity.tsx
- app/(student)/live-quiz.tsx

### Professor

- Transcricao: gravacao, resumo, quiz, pergunta aberta, envio para apresentacao
- Base de conhecimento: upload e gestao de arquivos para enriquecer IA
- Upload de material: envia arquivo e cadastra material
- Resultados: relatorios, podium, distribuicao e envio para apresentacao
- Atividades ativas: encerrar atividades em andamento

Arquivos principais:
- app/(teacher)/transcription.tsx
- app/(teacher)/ai-assistant.tsx
- app/(teacher)/upload-material.tsx
- app/(teacher)/quiz-results.tsx
- app/(teacher)/active-activities.tsx

### Admin

- Criacao de usuarios, disciplinas, matriculas e atribuicoes
- Configuracoes do sistema e status

Arquivo principal:
- app/(admin)/dashboard.tsx

### Apresentacao (segunda tela)

- [app/presentation.tsx] recebe codigo e exibe conteudo em tempo real
- Suporta: resumo, quiz, ranking, podium, imagens, videos e documentos
- Controle via polling e comandos de midia

Arquivos principais:
- components/presentation/*
- services/presentation.ts
- hooks/usePresentationPolling.ts

## Integracoes e dependencias externas

- API: usa EXPO_PUBLIC_API_URL (ex: https://api.suaempresa.com/api)
- Supabase Storage: EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY
- N8N Webhook: EXPO_PUBLIC_N8N_WEBHOOK_URL
- Base da apresentacao: EXPO_PUBLIC_PRESENTATION_BASE_URL

## Configuracao (variaveis de ambiente)

Crie um arquivo .env com:

EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_N8N_WEBHOOK_URL=
EXPO_PUBLIC_PRESENTATION_BASE_URL=

## Como rodar

1) Instalar dependencias

```bash
npm install
```

2) Iniciar o app

```bash
npx expo start
```

## Cronograma sugerido (para apresentacao do projeto)

Este cronograma e uma linha do tempo sugerida com base nos modulos existentes. Ajuste os tempos conforme seu historico real.

Fase 1 - Fundacao (Semanas 1-2)
- Setup Expo Router, design system, autenticacao e roles
- Base de navegacao e rotas principais

Fase 2 - Experiencia do Aluno (Semanas 3-4)
- Dashboard, materiais, atividades e notificacoes
- Live activity e live quiz

Fase 3 - Experiencia do Professor (Semanas 5-7)
- Transcricao, geracao IA, base de conhecimento
- Upload e distribuicao de materiais

Fase 4 - Apresentacao em tempo real (Semanas 8-9)
- Tela de apresentacao, slides e controle de midia
- Polling e sincronizacao de conteudo

Fase 5 - Resultados e analytics (Semanas 10-11)
- Relatorios de quiz, ranking e podium
- Exportacoes e distribuicao

Fase 6 - Admin e operacao (Semanas 12+)
- CRUD de usuarios e disciplinas
- Ajustes, estabilidade e melhorias

## Observacoes tecnicas importantes

- Polling substitui WebSocket em algumas telas para simplificar compatibilidade
- A tela de transcricao e o modulo mais complexo e central do app
- PDFViewer usa iframe na web e exibe aviso no mobile
- Upload de arquivos usa Supabase Storage como etapa intermediaria

## Onde aprofundar (para equipe tecnica)

- Rotas e fluxo inicial: app/index.tsx e app/_layout.tsx
- Servicos e APIs: services/api.ts, services/presentation.ts, services/quiz.ts, services/n8n.ts
- Componentes-chave de apresentacao: components/presentation/*
- Tela core do professor: app/(teacher)/transcription.tsx

