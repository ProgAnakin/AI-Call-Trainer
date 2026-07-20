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
| LLM | Claude API (`claude-sonnet-4-6`) via Supabase Edge Functions |
| Backend/DB | Supabase (PostgreSQL + Edge Functions) |
| Deploy | Vercel |
| Testes | Vitest |

### ⚠️ Regra de ouro de segurança

**A API key da Anthropic NUNCA vai no cliente.** Toda chamada ao LLM passa pelas
Edge Functions `/roleplay` e `/evaluate`, que guardam a key como secret e aplicam
**rate limiting por dispositivo** (máx. 30 turnos/call, 10 calls/dia, 12 avaliações/dia).
No cliente só existe a anon key do Supabase.

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
5. Configure um **spend limit** na console da Anthropic. Uma call de 10 turnos
   custa ~8–15k tokens; uso diário de treino ≈ poucos euros/mês.

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

Frameworks **SPICED** e **MEDDIC** também estão definidos em `src/data/frameworks.ts`.

Métricas objetivas calculadas em código (não pela IA): talk ratio
(meta: rep ≤ 55% em discovery), duração vs. time limit, perguntas feitas
e evolução histórica por semana.

## Voz — notas de implementação

- `SpeechRecognition` só funciona bem em **Chrome/Edge** → detecção automática com
  fallback para modo texto.
- **Push-to-talk** (segure o botão ou a barra de espaço) em vez de reconhecimento
  contínuo — mais confiável com sotaque/ruído.
- A transcrição aparece em tempo real e pode ser **editada antes de enviar**.
- Vozes TTS variam por sistema operacional; a mais próxima do idioma do cenário é
  escolhida automaticamente.

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
