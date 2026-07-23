# 🎙️ AI Call Trainer

Treinador de chamadas de vendas por IA. Você faz uma **cold call / discovery call**
(por voz no navegador ou por texto) com um **prospect simulado por Claude**, alimentado
com fichas de produto (Salesforce como catálogo inicial), e recebe ao final um
**scorecard de performance** com nota por critério, citações do transcript e plano de melhoria.

**Idiomas:** 🇧🇷 pt-BR · 🇵🇹 pt-PT · 🇮🇹 it-IT · 🇺🇸 en-US — UI em PT/IT/EN.

> SDRs só treinam em call real (queimando leads) ou com roleplay humano (caro, sem
> disponibilidade). As ferramentas existentes são enterprise, pagas por assento e
> centradas em inglês. Este projeto é gratuito, individual e multilíngue.

---

## Como funciona

```
┌────────────┐   fala    ┌──────────────────┐   texto   ┌──────────────────────┐
│  Usuário   │──────────▶│  Web Speech API   │──────────▶│ Edge Fn: /roleplay    │
│ (navegador)│◀──────────│  (STT + TTS)      │◀──────────│  → Claude (persona)   │
└────────────┘   áudio    └──────────────────┘  resposta └──────────────────────┘
      │                                                            │
      │ fim da call                                                ▼
      │                 ┌──────────────────────┐        ┌──────────────────────┐
      └────────────────▶│ Edge Fn: /evaluate    │───────▶│ Supabase (sessions,   │
                        │  → Claude (avaliador) │        │ turns, evaluations)   │
                        └──────────────────────┘        └──────────────────────┘
```

Dois "cérebros" separados, dois prompts separados:

1. **Prospect (roleplay):** responde em personagem, curto, natural, com objeções.
   `temperature 0.8`, `max_tokens 200`.
2. **Avaliador (juiz):** recebe o transcript completo ao final e devolve JSON com
   scorecard. `temperature 0.2`, JSON validado no servidor com retry.

Eles nunca se misturam — o prospect não "sabe" que existe avaliação.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + componentes próprios estilo shadcn |
| Animações | Framer Motion |
| Voz | Web Speech API (`SpeechRecognition` push-to-talk + `speechSynthesis`) |
| LLM | Claude API (`claude-haiku-4-5` por default — configurável) via Supabase Edge Functions |
| Backend/DB | Supabase (PostgreSQL + Edge Functions) |
| Deploy | Vercel |
| Testes | Vitest |

### ⚠️ Regra de ouro de segurança

**A API key da Anthropic NUNCA vai no cliente.** Toda chamada ao LLM passa pelas
Edge Functions `/roleplay` e `/evaluate`, que guardam a key como secret e aplicam
**rate limiting por dispositivo** (defaults: 20 turnos/call, 6 calls/dia,
8 avaliações/dia — ajustáveis via secrets, ver tabela abaixo).
No cliente só existe a anon key do Supabase.

### 💰 Custo — desenhado para ser (quase) zero

| Item | Custo |
|---|---|
| Supabase (banco + Edge Functions) | **€0** — free tier |
| Vercel (hosting) | **€0** — free tier |
| Modo demo (sem Claude configurado) | **€0** — prospect e avaliador simulados |
| Claude API (modo real) | **pay-per-use** — só paga o que consumir, sem mensalidade |

O modelo default é o **Claude Haiku 4.5** (US$ 1/M tokens de entrada,
US$ 5/M de saída — o mais barato da família e ótimo para falas curtas em
personagem). Contas reais:

- 1 call de 10 turnos + avaliação ≈ 15–20k tokens ≈ **US$ 0,03**
- Uso realista de treino (1–3 calls/dia, alguns dias por semana) ≈ **< €1/mês**
- Pior caso com os limites default (6 calls × 30 dias) ≈ **~€5/mês** — e para
  isso você teria que treinar no teto do limite todos os dias do mês

Camadas de proteção, da mais interna à mais externa:

1. `max_tokens` baixo em toda chamada (falas curtas por design)
2. Rate limit por dispositivo nas Edge Functions (tabela abaixo)
3. **Spend limit na console da Anthropic** — é um TETO, não uma assinatura:
   configure US$ 5 e é matematicamente impossível gastar mais que isso

Configuração opcional via secrets (sem redeploy):

| Secret | Default | Para quê |
|---|---|---|
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` | Modelo do prospect |
| `ANTHROPIC_EVAL_MODEL` | = `ANTHROPIC_MODEL` | Modelo do avaliador — `claude-sonnet-4-6` dá feedback de coach mais profundo por ~3× o custo |
| `MAX_CALLS_PER_DAY` | `6` | Calls de roleplay por dispositivo/dia |
| `MAX_EVALS_PER_DAY` | `8` | Avaliações por dispositivo/dia |
| `MAX_TURNS_PER_CALL` | `20` | Turnos do rep por call |

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # métricas objetivas (talk ratio, perguntas, streak...)
npm run build      # typecheck + bundle de produção
```

Sem configurar nada, o app roda em **modo demo**: o prospect e o avaliador são
simulados localmente (sem custo, sem IA) — útil para conhecer o fluxo completo
de UI. O badge "Modo demo" fica visível no header.

## Ligando o Claude (modo real)

**Sem terminal (pelo navegador):** siga o guia passo a passo em
[`supabase/dashboard-deploy/README.md`](supabase/dashboard-deploy/) — copiar e
colar as duas funções no painel do Supabase.

**Pelo terminal (CLI):**

1. Crie um projeto no [Supabase](https://supabase.com) (free tier).
2. Aplique a migration:
   ```bash
   supabase db push        # ou cole supabase/migrations/0001_init.sql no SQL editor
   ```
3. Configure a secret e faça deploy das Edge Functions:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy roleplay
   supabase functions deploy evaluate
   ```
4. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY`.
5. Configure um **spend limit** na console da Anthropic (ex.: US$ 5). É só um
   teto de segurança — você paga apenas o que usar (ver seção de custo acima).

## Deploy (Vercel)

Importe o repositório na Vercel, adicione as duas env vars `VITE_SUPABASE_*` e
pronto — `vercel.json` já cuida do rewrite de SPA. Microfone exige HTTPS (ok na Vercel).

## Estrutura

```
src/
├── components/
│   ├── call/            # PushToTalk, Waveform, Timer, TranscriptLive
│   ├── scorecard/       # ScoreReveal, CriterionCard, ImprovementList
│   ├── library/         # ProductForm, PersonaForm, ScenarioBuilder
│   └── dashboard/       # ProgressChart, SessionHistory, StreakBadge
├── data/
│   ├── seed/            # 4 produtos Salesforce + 6 personas + 8 cenários
│   └── frameworks.ts    # critérios e pesos: básico / SPICED / MEDDIC
├── hooks/
│   ├── useSpeech.ts     # STT + TTS unificados (push-to-talk)
│   ├── useCallSession.ts# máquina de estados da call
│   └── useProgress.ts   # métricas históricas + streak
├── lib/
│   ├── supabase.ts      # cliente + device id anônimo
│   ├── storage.ts       # persistência (Supabase ou localStorage)
│   ├── api.ts           # roleplay/evaluate (Edge Functions ou modo demo)
│   └── metrics.ts       # talk ratio, contagem de perguntas (client-side)
├── i18n/                # UI em PT / IT / EN
└── pages/               # Home, Call, Scorecard, Progress, Library
supabase/
├── functions/
│   ├── roleplay/        # persona → Claude → resposta (com rate limit)
│   ├── evaluate/        # transcript → Claude → JSON scorecard
│   └── _shared/         # CORS, rate limiting, cliente Anthropic
└── migrations/          # schema + seed com UUIDs fixos
```

### Máquina de estados da call

`briefing → listening/waiting_input → processing → speaking → (loop) → ended → evaluating → scored`

## Scorecard — critérios e pesos (framework básico)

| Critério | Peso | O que mede |
|---|---|---|
| Abertura | 15% | Pattern interrupt, permissão, motivo da ligação em <20s |
| Descoberta | 25% | Perguntas abertas, qualificação, cavou a dor? |
| Escuta ativa | 15% | Respondeu ao que a persona disse ou seguiu script cego? |
| Tratamento de objeções | 20% | Acknowledge → explore → respond |
| Clareza de valor | 10% | Conectou feature → dor específica da persona |
| Próximo passo | 15% | Pediu o meeting? Data/hora concreta? |

Frameworks **SPICED** e **MEDDIC** também estão definidos em `src/data/frameworks.ts`,
e a rubrica é **escolhida automaticamente pelo tipo de call** (`frameworkForCallType`):
cold call → Fundamentos, discovery → SPICED, negociação → MEDDIC. Uma cold call e uma
negociação são jogos diferentes e não devem ser avaliadas pela mesma régua.

### Conversation intelligence — métricas objetivas (custo de IA zero)

Calculadas em código a partir do transcript + timestamps (não pela IA), no estilo
Gong/Chorus:

- **Talk ratio** (meta: rep ≤ 55% em discovery) e **maior monólogo do rep** (meta < 150 palavras)
- **Ritmo** em palavras/min (só no modo voz)
- **Perguntas abertas vs. fechadas** e **tempo até a 1ª pergunta**
- **Muletas de linguagem** por idioma ("tipo", "né", "cioè", "like"...)
- **Próximo passo concreto** detectado (dia/hora)
- Duração vs. time limit; **taxa de meeting agendado** e evolução histórica no dashboard

A **nota geral é sempre recalculada no servidor** a partir das notas por critério ×
pesos do framework — a IA dá as notas e os comentários, a matemática é determinística.

### Feedback cirúrgico do avaliador

Além das notas por critério, o scorecard traz: **foco único para a próxima call**,
**mapa de objeções** (ignorou / rebateu na hora / explorou), **sinais de compra
perdidos**, **reescrita da abertura**, e **melhor / pior linha** — tudo com citação
do transcript. O dashboard destaca o **critério mais fraco** para o rep saber onde focar.
O scorecard também inclui o **transcript completo da call** (colapsável).

### Objection Gauntlet — treino rápido de objeções

Em `/drill`: uma rajada de objeções reais do produto, uma a uma. Você responde,
recebe uma **nota instantânea** (reconhecer → explorar → responder) e vê a
**resposta modelo** para comparar. Tudo **client-side** (custo de IA zero, feedback
imediato — ideal para rajada) com recorde pessoal por produto. É o treino diário
que um SDR realmente repete.

### Humor do prospect

Cada cenário tem um **humor** (apressado / desconfiado / curioso / cordial-mas-evasivo
/ irritado), mostrado no briefing e injetado no prompt do prospect — um CEO apressado
e um ops curioso mudam a call inteira.

## Voz — notas de implementação

- `SpeechRecognition` só funciona bem em **Chrome/Edge** → detecção automática com
  fallback para modo texto.
- **Push-to-talk** (segure o botão ou a barra de espaço) em vez de reconhecimento
  contínuo — mais confiável com sotaque/ruído.
- A transcrição aparece em tempo real e pode ser **editada antes de enviar**.
- Vozes TTS variam por sistema operacional; no briefing dá para **escolher a voz**
  do prospect entre as disponíveis para o idioma (a escolha fica salva por idioma).
- Quando o prospect encerra a call, a avaliação só começa **depois** que o TTS
  termina de falar a última frase.

## Personas seed

| Persona | Perfil | Dificuldade natural |
|---|---|---|
| Marta, CFO | Cética, foco em ROI, sem tempo | 4 |
| Paulo, Head de Vendas | Aberto mas "já usa HubSpot" | 3 |
| Giulia, Ops Manager | Curiosa, sem poder de decisão | 2 |
| Ricardo, CEO PME | Direto, "me manda um email" | 4 |
| Ana, IT Director | Técnica, preocupada com integração | 3 |
| Sr. Bianchi, dono tradicional | Desconfiado de tecnologia | 5 |

## Roadmap

- [x] **Fase 1 — MVP texto:** chat de roleplay + avaliador JSON + scorecard
- [x] **Fase 2 — Voz:** push-to-talk, waveform, timer, transcrição ao vivo, fallback texto
- [x] **Fase 3 — Scorecard sério:** frameworks SPICED/MEDDIC, métricas objetivas, dashboard + streak
- [x] **Fase 4 — Escala:** biblioteca CRUD (seu produto/persona), multilíngue PT/IT/EN
- [ ] TTS premium (ElevenLabs/OpenAI) como upgrade opcional
- [ ] Modos AE avançados (demo guiada, negociação com procurement)
