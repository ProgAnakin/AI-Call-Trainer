# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub: **Security → Advisories → "Report a vulnerability"**
on this repository. Include what you found, how to reproduce it, and what an attacker
could do with it. A proof of concept against your own deployment is ideal.

This is a personal, free, volunteer-maintained project, so there is no bounty and no
guaranteed response time — but reports are read, fixed, and credited if you want.

## What is in scope

- The web app (`src/`) and its service worker (`public/sw.js`)
- The Supabase Edge Functions (`supabase/functions/`) and the single-file copies in
  `supabase/dashboard-deploy/`
- The database migrations (`supabase/migrations/`) and the row-level security they set up
- The deployment headers in `vercel.json`

## What is out of scope

- Findings that require the attacker to already control the victim's browser or the
  Supabase / Anthropic / Vercel accounts
- Weaknesses in Supabase, Anthropic, Vercel, or the user's browser themselves
- Denial of service by sheer traffic volume (the rate limits are cost controls, not DDoS
  protection)
- Output quality of the AI prospect or coach (a model saying something odd is not a
  vulnerability unless it can be turned into one of the above)

## Design notes that help a reviewer

- The Anthropic API key exists **only** as a Supabase secret. The browser holds just the
  Supabase anon key, which is public by design.
- The app is single-player and stores history in the user's own browser, so the data worth
  protecting is the **API bill** and the **availability of the app**, not other users' data.
- Everything the client sends and everything it reads back from `localStorage` or a backup
  file is treated as hostile.

See [`docs/SECURITY-TESTING.md`](docs/SECURITY-TESTING.md) for how the controls are tested
and which risks could not be verified.
