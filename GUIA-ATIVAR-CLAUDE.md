# Guia: ativar o Claude de verdade (sair do modo demo)

Este guia é em português e passo a passo. No fim, o selo **"Modo demo — sem IA"**
some, o prospect passa a ser o **Claude de verdade** (respostas adaptam ao que
você fala) e o scorecard ganha o feedback qualitativo de um coach.

> Enquanto isso não é feito, o app funciona em **modo demo**: o prospect segue
> um roteiro fixo (não adapta ao que você diz) e o scorecard usa só as métricas
> objetivas. Serve pra testar a interface, mas o valor real de treino vem do Claude.

---

## O único custo

- **Supabase**: plano grátis é suficiente.
- **Anthropic (Claude)**: é o único custo. Uma call de ~10 turnos + avaliação
  custa cerca de **US$ 0,03** (três centavos de dólar) no modelo padrão
  (Claude Haiku 4.5). Você define um **teto de gasto** na conta da Anthropic —
  recomendo começar com **US$ 5**. Os limites diários no código já seguram o
  custo mesmo se alguém abusar (6 calls/dia por dispositivo, por padrão).

---

## Antes de começar

Você vai precisar de:
1. Uma conta **Supabase** (grátis) — https://supabase.com
2. Uma conta **Anthropic** com crédito — https://console.anthropic.com
3. O **Supabase CLI** instalado no seu computador (só para publicar as funções).

> Onde eu, o assistente, entro: já deixei todo o código pronto (as duas Edge
> Functions `roleplay` e `evaluate`, as migrations do banco e o cliente).
> Os passos abaixo você faz na sua conta, porque envolvem senhas e a sua chave —
> que **nunca** devem passar por mim nem ir para o código.

---

## Passo 1 — Criar o projeto Supabase (~3 min)

1. Entre em https://supabase.com e clique **New project**.
2. Dê um nome (ex.: `ai-call-trainer`), escolha uma senha de banco e a região
   mais perto de você. Clique **Create new project** e aguarde ~2 min.

## Passo 2 — Criar as tabelas do banco (~2 min)

O jeito mais simples (sem terminal): pelo painel.

1. No projeto, abra **SQL Editor** (menu lateral) → **New query**.
2. Abra o arquivo `supabase/migrations/0001_init.sql` deste repositório, copie
   **todo** o conteúdo, cole no editor e clique **Run**.
3. Repita com `supabase/migrations/0002_user_backups.sql` (só é necessário se
   quiser a sincronização entre dispositivos; não atrapalha se rodar também).

## Passo 3 — Pegar a chave da Anthropic + colocar teto de custo (~3 min)

1. Entre em https://console.anthropic.com → **Billing** e adicione um crédito
   (ex.: US$ 5). Em **Limits**, defina um teto mensal para dormir tranquilo.
2. Vá em **API Keys** → **Create key**, copie a chave (começa com `sk-ant-...`).
   Guarde num lugar seguro — ela **não** vai para o código nem para o Vercel.

## Passo 4 — Publicar as Edge Functions (~5 min, no terminal)

As Edge Functions são o "cofre" onde a chave da Anthropic vive. Publique-as:

```bash
# 1. Instale o Supabase CLI (uma vez). Alternativas: brew install supabase/tap/supabase
npm install -g supabase

# 2. Faça login (abre o navegador)
supabase login

# 3. Ligue o CLI ao seu projeto. O <PROJECT-REF> está em
#    Project Settings → General → "Reference ID" no painel do Supabase.
supabase link --project-ref <PROJECT-REF>

# 4. Guarde a chave da Anthropic como secret (só aqui ela existe)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-cole-sua-chave-aqui

# 5. Publique as duas funções
supabase functions deploy roleplay
supabase functions deploy evaluate
```

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo
> Supabase nas funções — você **não** precisa setar essas.

## Passo 5 — Conectar o site (Vercel) ao Supabase (~3 min)

O site precisa de dois valores **públicos** do Supabase (nunca a chave da
Anthropic). No painel do Supabase: **Project Settings → API**:
- **Project URL** → vira `VITE_SUPABASE_URL`
- **anon public** key → vira `VITE_SUPABASE_ANON_KEY`

No Vercel (https://vercel.com → seu projeto `ai-call-trainer`):
1. **Settings → Environment Variables** e adicione as duas:
   - `VITE_SUPABASE_URL` = a Project URL
   - `VITE_SUPABASE_ANON_KEY` = a anon key
2. Marque os ambientes (Production, Preview, Development).

## Passo 6 — Redeploy no Vercel (obrigatório)

O Vite "assa" as variáveis no momento do build, então **precisa** redeployar:
- No Vercel: aba **Deployments** → no deploy mais recente, menu **⋯** → **Redeploy**.

## Passo 7 — Conferir

Abra seu site. Se deu certo:
- O selo **"Modo demo — sem IA"** no topo **some**.
- Aparece o botão de **login/sincronizar (☁)** no cabeçalho.
- Numa call, o prospect responde de forma diferente conforme o que você fala
  (não é mais roteiro fixo).

Seus endereços do Vercel (do seu print) — use o de **produção** aqui:
- `ai-call-trainer-98sqhl7vw-anakins-projects-fb8fdee1.vercel.app`
- (preview da branch) `ai-call-trainer-git-claude-ai-ebc72e-anakins-projects-fb8fdee1.vercel.app`

---

## Opcional A — Ligar a sincronização entre dispositivos

Só se você quiser treinar no PC e no celular e juntar o progresso. No Supabase:
- **Authentication → URL Configuration**: em **Site URL** coloque a URL de
  produção do seu site; em **Redirect URLs** adicione a mesma URL e, se for
  desenvolver local, `http://localhost:5173`.
- **Authentication → Providers → Email**: já vem ligado (envia ~4 e-mails/hora,
  ok para uso pessoal). Para volume maior, plugue um SMTP próprio.

## Opcional B — Ajustar limites de custo (sem mexer no código)

```bash
supabase secrets set MAX_CALLS_PER_DAY=10      # calls por dispositivo/dia (padrão 6)
supabase secrets set MAX_EVALS_PER_DAY=12      # avaliações por dispositivo/dia (padrão 8)
supabase secrets set ANTHROPIC_EVAL_MODEL=claude-sonnet-4-6  # coach mais profundo (~3x o custo)
```

---

## Deu erro?

- **Ainda aparece "Modo demo"** → as env vars não entraram no build. Confira o
  nome exato (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) e **redeploy**.
- **"daily limit reached"** → você bateu o limite diário (proteção de custo).
  Aumente com o Passo Opcional B ou espere o dia virar (UTC).
- **Erro 500 na call** → a `ANTHROPIC_API_KEY` não foi setada como secret, ou
  a conta Anthropic está sem crédito. Refaça o Passo 3 e 4.
