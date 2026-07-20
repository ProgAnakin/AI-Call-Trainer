# Deploy das Edge Functions pelo painel do Supabase (sem terminal)

Guia para ligar o Claude usando só o navegador. Os dois arquivos desta pasta
(`roleplay.ts` e `evaluate.ts`) são versões "tudo num arquivo só" das funções —
prontas para copiar e colar. (As versões em `supabase/functions/` são as
mesmas, organizadas para deploy por linha de comando.)

> Pré-requisito: você já criou o projeto no Supabase e já rodou a migration
> `supabase/migrations/0001_init.sql` no SQL Editor. ✔

---

## Passo 1 — Guardar a API key da Anthropic como secret

1. No painel do Supabase, menu lateral → **Edge Functions**.
2. Aba **Secrets** (ou **Project Settings → Edge Functions → Secrets**).
3. **Add new secret**:
   - Name: `ANTHROPIC_API_KEY`
   - Value: sua chave `sk-ant-...` (pegue em console.anthropic.com)
4. Salvar.

As secrets `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem
automaticamente — não precisa criar.

> Opcionais (só se quiser mudar os defaults): `ANTHROPIC_MODEL`,
> `ANTHROPIC_EVAL_MODEL`, `MAX_CALLS_PER_DAY`, `MAX_EVALS_PER_DAY`,
> `MAX_TURNS_PER_CALL`. Veja a tabela no README principal.

---

## Passo 2 — Criar a função `roleplay`

1. **Edge Functions → Deploy a new function → Via Editor** (ou "Create function").
2. Nome da função: exatamente **`roleplay`** (tudo minúsculo).
3. Apague o código de exemplo que vier no editor.
4. Abra o arquivo [`roleplay.ts`](./roleplay.ts) aqui do repositório, clique em
   **Raw** (ou no botão de copiar), e cole **todo** o conteúdo no editor.
5. Clique em **Deploy**.

---

## Passo 3 — Criar a função `evaluate`

Repita o Passo 2, mas:
- Nome da função: exatamente **`evaluate`**.
- Cole o conteúdo de [`evaluate.ts`](./evaluate.ts).
- **Deploy**.

---

## Passo 4 — Ligar o site à sua conta Supabase

No arquivo `.env` do projeto (copie de `.env.example`), preencha:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

Ambos estão em **Project Settings → API**:
- `VITE_SUPABASE_URL` = "Project URL"
- `VITE_SUPABASE_ANON_KEY` = a chave "anon" / "public"

(Se você for publicar na Vercel, coloque essas mesmas duas variáveis lá também,
em Settings → Environment Variables.)

---

## Como saber se deu certo

- Faça uma call. Se o **badge "Modo demo"** sumiu do topo do site, o `.env`
  foi lido e o app está falando com o Supabase. ✅
- Se o prospect responde com falas variadas e naturais (não roteirizadas), o
  Claude está no ar. 🎉
- Deu erro? Em **Edge Functions → roleplay → Logs** você vê a mensagem exata
  (ex.: `ANTHROPIC_API_KEY secret not set` = revise o Passo 1).
