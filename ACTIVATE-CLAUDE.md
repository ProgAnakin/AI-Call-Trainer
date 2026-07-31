# Guide: turn on the real Claude (leave demo mode)

A step-by-step guide. At the end, the **"Demo mode — no AI"** badge disappears,
the prospect becomes the **real Claude** (replies adapt to what you say), and the
scorecard gains a coach's qualitative feedback.

> Until this is done, the app runs in **demo mode**: the prospect follows a fixed
> script (it does not adapt to what you say) and the scorecard uses only the
> objective metrics. It is enough to test the interface, but the real training
> value comes from Claude.

---

## The only cost

- **Supabase**: the free plan is enough.
- **Anthropic (Claude)**: this is the only cost. A ~10-turn call + evaluation
  costs about **US$ 0.03** (three US cents) on the default model
  (Claude Haiku 4.5). You set a **spend cap** on the Anthropic account — I
  recommend starting with **US$ 5**. The daily limits in the code already hold
  the cost down even if someone abuses it (6 calls/day per device by default).

---

## Before you start

You will need:
1. A **Supabase** account (free) — https://supabase.com
2. An **Anthropic** account with credit — https://console.anthropic.com
3. The **Supabase CLI** installed on your computer (only to publish the functions).

> Where the code already stands: the two Edge Functions (`roleplay` and
> `evaluate`), the database migrations and the client are all ready. The steps
> below you do on your own account, because they involve passwords and your key —
> which must **never** go into the code.

---

## Step 1 — Create the Supabase project (~3 min)

1. Go to https://supabase.com and click **New project**.
2. Give it a name (e.g. `ai-call-trainer`), choose a database password and the
   region closest to you. Click **Create new project** and wait ~2 min.

## Step 2 — Create the database tables (~2 min)

The simplest way (no terminal): from the dashboard.

1. In the project, open **SQL Editor** (sidebar) → **New query**.
2. Open `supabase/migrations/0001_init.sql` from this repo, copy **all** of it,
   paste it into the editor and click **Run**.
3. Repeat with `supabase/migrations/0002_user_backups.sql` (only needed if you
   want cross-device sync; running it anyway does no harm).

## Step 3 — Get the Anthropic key + set a spend cap (~3 min)

1. Go to https://console.anthropic.com → **Billing** and add some credit
   (e.g. US$ 5). Under **Limits**, set a monthly cap to sleep easy.
2. Go to **API Keys** → **Create key**, copy the key (starts with `sk-ant-...`).
   Store it somewhere safe — it does **not** go into the code or into Vercel.

## Step 4 — Publish the Edge Functions (~5 min, in the terminal)

The Edge Functions are the "vault" where the Anthropic key lives. Publish them:

```bash
# 1. Install the Supabase CLI (once). Alternatives: brew install supabase/tap/supabase
npm install -g supabase

# 2. Log in (opens the browser)
supabase login

# 3. Link the CLI to your project. The <PROJECT-REF> is under
#    Project Settings → General → "Reference ID" in the Supabase dashboard.
supabase link --project-ref <PROJECT-REF>

# 4. Store the Anthropic key as a secret (it only exists here)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-paste-your-key-here

# 5. Publish the two functions
supabase functions deploy roleplay
supabase functions deploy evaluate
```

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
> Supabase into the functions — you do **not** need to set those.

## Step 5 — Connect the site (Vercel) to Supabase (~3 min)

The site needs two **public** Supabase values (never the Anthropic key). In the
Supabase dashboard: **Project Settings → API**:
- **Project URL** → becomes `VITE_SUPABASE_URL`
- **anon public** key → becomes `VITE_SUPABASE_ANON_KEY`

In Vercel (https://vercel.com → your `ai-call-trainer` project):
1. **Settings → Environment Variables** and add the two:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon key
2. Tick the environments (Production, Preview, Development).

## Step 6 — Redeploy on Vercel (required)

Vite bakes the variables in at build time, so you **must** redeploy:
- In Vercel: **Deployments** tab → on the latest deploy, menu **⋯** → **Redeploy**.

## Step 7 — Verify

Open your site. If it worked:
- The **"Demo mode — no AI"** badge at the top **disappears**.
- The **login/sync (☁)** button appears in the header.
- On a call, the prospect replies differently depending on what you say
  (no longer a fixed script).

Use your **production** URL from the Vercel dashboard, e.g.
`https://your-app.vercel.app`.

---

## Optional A — Turn on cross-device sync

Only if you want to train on your PC and phone and merge the progress. In Supabase:
- **Authentication → URL Configuration**: in **Site URL** put your site's
  production URL; in **Redirect URLs** add the same URL and, if you develop
  locally, `http://localhost:5173`.
- **Authentication → Providers → Email**: already on (sends ~4 emails/hour, fine
  for personal use). For higher volume, plug in your own SMTP.

## Optional B — Adjust cost limits (without touching the code)

```bash
supabase secrets set MAX_CALLS_PER_DAY=10      # calls per device/day (default 6)
supabase secrets set MAX_EVALS_PER_DAY=12      # evaluations per device/day (default 8)
supabase secrets set ANTHROPIC_EVAL_MODEL=claude-sonnet-4-6  # deeper coach (~3x the cost)
```

---

## Got an error?

- **Still shows "Demo mode"** → the env vars did not make it into the build.
  Check the exact names (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and
  **redeploy**.
- **"daily limit reached"** → you hit the daily limit (cost protection). Raise it
  with Optional Step B or wait for the day to roll over (UTC).
- **500 error on a call** → the `ANTHROPIC_API_KEY` was not set as a secret, or
  the Anthropic account is out of credit. Redo Steps 3 and 4.
