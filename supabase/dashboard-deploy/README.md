# Deploy the Edge Functions from the Supabase dashboard (no terminal)

A guide to turning on Claude using only your browser. The two files in this
folder (`roleplay.ts` and `evaluate.ts`) are "everything in one file" versions
of the functions — ready to copy and paste. (The versions in
`supabase/functions/` are the same, organized for command-line deploy.)

> Prerequisite: you already created the project on Supabase and already ran the
> `supabase/migrations/0001_init.sql` migration in the SQL Editor. ✔

---

## Step 1 — Store the Anthropic API key as a secret

1. In the Supabase dashboard, sidebar → **Edge Functions**.
2. **Secrets** tab (or **Project Settings → Edge Functions → Secrets**).
3. **Add new secret**:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your `sk-ant-...` key (get it at console.anthropic.com)
4. Save.

The `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets already exist
automatically — no need to create them.

> Optional (only if you want to change the defaults): `ANTHROPIC_MODEL`,
> `ANTHROPIC_EVAL_MODEL`, `MAX_CALLS_PER_DAY`, `MAX_EVALS_PER_DAY`,
> `MAX_TURNS_PER_CALL`. See the table in the main README.
>
> Recommended for security: set `ALLOWED_ORIGINS` to your exact site origin(s),
> comma-separated (e.g. `https://your-app.vercel.app`). This restricts who can
> call the functions via a browser. localhost is always allowed for dev; if you
> leave it unset, any `*.vercel.app` origin is accepted as a fallback.

> Note: `roleplay.ts` and `evaluate.ts` here are **auto-generated** from
> `supabase/functions/` by `build.mjs` — don't edit them by hand.

---

## Step 2 — Create the `roleplay` function

1. **Edge Functions → Deploy a new function → Via Editor** (or "Create function").
2. Function name: exactly **`roleplay`** (all lowercase).
3. Delete the sample code that comes in the editor.
4. Open [`roleplay.ts`](./roleplay.ts) from this repo, click **Raw** (or the copy
   button), and paste **all** of the content into the editor.
5. Click **Deploy**.

---

## Step 3 — Create the `evaluate` function

Repeat Step 2, but:
- Function name: exactly **`evaluate`**.
- Paste the content of [`evaluate.ts`](./evaluate.ts).
- **Deploy**.

---

## Step 4 — Connect the site to your Supabase account

In the project's `.env` file (copy from `.env.example`), fill in:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Both are under **Project Settings → API**:
- `VITE_SUPABASE_URL` = "Project URL"
- `VITE_SUPABASE_ANON_KEY` = the "anon" / "public" key

(If you deploy to Vercel, add these same two variables there too, under
Settings → Environment Variables.)

---

## How to know it worked

- Make a call. If the **"Demo mode" badge** disappeared from the top of the
  site, the `.env` was read and the app is talking to Supabase. ✅
- If the prospect replies with varied, natural lines (not scripted), Claude is
  live. 🎉
- Got an error? Under **Edge Functions → roleplay → Logs** you can see the exact
  message (e.g. `ANTHROPIC_API_KEY secret not set` = revisit Step 1).
