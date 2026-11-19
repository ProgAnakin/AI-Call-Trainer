# Security testing

How the app's security controls are tested, what the tests found, and — just as important —
what they **could not** verify.

The rule behind this document: **only report what was observed.** Anything that could not be
confirmed against running code is listed as a *hypothesis to validate*, not as a finding.

## Threat model in one paragraph

The app is single-player and keeps its history in the user's own browser, so there is no other
user's data to steal. The assets worth protecting are (1) **the Anthropic bill**, reachable
through two public endpoints, and (2) **the availability of the app** for someone who loads
hostile data (an imported backup, a corrupted `localStorage`). Everything the client sends,
and everything it reads back from storage, is treated as hostile.

## Running it

```bash
npm test             # every unit and attack suite below
npm run test:e2e     # browser checks, incl. security headers under the real CSP
npm run lint         # ESLint
npm audit            # dependency advisories
```

## What is covered

| Suite | Target | What it does |
|---|---|---|
| `supabase/functions/security.test.ts` | Edge Functions | Runs the **real production code** under a simulated Deno, an in-memory Supabase and a recording Anthropic, and attacks it: CORS, input validation, concurrency, database failure, secret leakage. Executed against both the canonical functions **and** the single-file `dashboard-deploy/` copies that dashboard users actually paste. |
| `src/security.test.ts` | Client | Prototype pollution, hostile backups, schema validation, direct `localStorage` tampering, ReDoS timing on 1 MB inputs, seeded fuzzing with invariants, CSV injection. |
| `src/sw.test.ts` | Service worker | Runs `public/sw.js` for real: what becomes the offline shell, cache growth. |
| `supabase/migrations.test.ts` | Database | Applies migrations `0001 → 0003` in order **as text** and asserts the final row-level-security state. |
| `src/i18n/hardcoded.test.ts` | UI | No user-facing text outside the dictionary (found 6). |
| `e2e/smoke.mjs` | Browser | Security headers served exactly as `vercel.json` defines them (via `e2e/prod-server.mjs`), CSP blocking inline/external script and exfiltration, clickjacking, XSS payloads in every rendering surface, tampered storage across all routes, mobile overflow, WCAG 2.1 AA. |

`vite preview` does not read `vercel.json`, so the security headers had never run against the
build until `e2e/prod-server.mjs` existed.

## Findings

Each row was **observed** against the code as it was — by a test that failed, or by reproducing
it in a real browser. Where a detail rests only on reasoning or on an isolated check, the row
says so. Severity is calibrated for this app's threat model, not generic CVSS.

### Cost control and the Edge Functions

| ID | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| EF-1 | **High** | **Rate limiter race (check-then-insert).** Concurrent requests all read the counter before any wrote, so the daily cap did not hold. | 40 concurrent requests against a cap of 6: **40 allowed** (`D3`). | Reserve → verify → roll back; with a short argument that at most `cap` requests can pass. Control test `F1` shows ordinary concurrent use is not over-blocked. |
| EF-2 | **High** | **Limiter failed open.** The database `error` was ignored, so a missing table (migration not run), an outage or a bad policy meant a counter of zero and *no limit, silently*. | Database failure → **HTTP 200** (`D4`). | Fail closed with `503`; the rollback path is tested for partial failures (`F3`, `F4`, `F5`). |
| EF-3 | Medium | **Size limit bypass.** The cap measured `content.length`; on an array that is the number of *blocks*, so one huge block passed. Cost amplification the limit never saw. | Request with a 1 MB block → **200** (`B3`); also numbers/objects/`null` as `content` (`B5`). | `content` must be a string; every field validated by type and size. |
| EF-4 | Medium | **Unvalidated fields interpolated into prompts**: `scenario.language`, `call_type`, `difficulty`, `ui_language`, `success_criteria` had no allowlist and no cap. `ui_language: "xx"` produced the literal text `undefined` in the prompt. | `B6`–`B9`, `C3`–`C7` all accepted. | Allowlists for every enum; caps for every string. |
| EF-5 | Low | **`device_id` unvalidated**, so a client could send `ip:<address>` and write counters belonging to that IP's pseudo-device. | `B11` accepted `ip:203.0.113.9` and 1 MB ids. | Must be a UUID. |
| EF-6 | Low–Med | **CORS "deny" value was `null`**, which is what browsers send as `Origin` from sandboxed iframes and `file://` — so it *matched*. Also accepted `http://*.vercel.app`. | `A2` (`null`), `A4`. | Omit the header when not allowed; require HTTPS for the fallback. |
| EF-7 | Low | No body-size cap before parsing; malformed JSON or `null` returned `500`. | `B1`, `B2`, `B14`. | Capped streaming read; `400`/`413`. |
| EF-8 | Info | JSON responses lacked `nosniff` / `no-store` (`E3`, observed). Separately, by reading the code: one validation ("history must end with a rep turn") ran *after* the limiter, so that kind of invalid request consumed quota. | `E3`; code order. | Headers added; all validation now precedes the limiter. |

### Client

| ID | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| CL-1 | Medium | **Prototype pollution.** `history[productId] ??= {}` with `productId === "__proto__"` returns `Object.prototype`; the next write sets properties on *every object*. An objection named `__proto__` does the same one level down. Reachable through an imported backup (`P4` shows such ids were stored). | `Object.prototype.x` was set (`P1`, observed at function level; the full path through the Drill screen was not exercised end to end). | Reject unsafe keys, `hasOwn` reads; same hardening in `getFramework` and the language lookup. |
| CL-2 | Medium | **No schema validation → persistent crash loop.** One malformed item made `listSessions()` throw `Cannot read properties of undefined (reading 'localeCompare')`. Because the bad data stays in storage, reloading did not help — and the screens with export/import/delete were the ones that crashed. | In a real browser, `sessions=[null]` and `evaluations=[{…}]` broke **Home and Progress**; `custom_products=[{id}]` broke Library. | Schema guard on every read and on import; malformed items dropped; "Reset app data" in the error screen as a last resort. |
| CL-3 | Low–Med | A backup could **overwrite the built-in catalog** (same id as an official product). | `S6`, `T6`. | Seed ids are protected; imported catalog is always marked custom. |
| CL-4 | Low | `computeMetrics` produced `NaN` for invalid dates (spreads to charts and CSV). | `F3`: `durationSeconds=NaN`. | Finite check. |
| CL-5 | Low | Import had no file-size cap (`S10`, observed). `saveDrillBest` would **throw** when the stored value is a string: `map[id] = avg` on a primitive string is a `TypeError` in strict mode (verified in isolation; the old function itself was not run against it). | `S10`; isolated check. | 10 MB cap; validated reads (`T2`). |
| CL-6 | Low–Med | **Service worker** wrote *any* navigation response — including a transient `502`/`404` — over the offline `index.html`, and its asset cache never shrank across deploys. | 6 of 11 service-worker tests failed against the previous `sw.js`. | Cache only `ok` + same-origin; 80-entry cap; cache renamed to purge the old one. |

### Hardening (no exploit observed)

`Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` headers added; CI token reduced
to `contents: read`; upstream error text redacted before logging; text inputs got `maxLength`.

## Tested and **not** vulnerable

These were attacked and held. They are as important as the findings.

- **XSS** — payloads (`<img onerror>`, `<svg onload>`, `<script>`, template-injection strings)
  in every field of a custom product, persona and scenario; in a stored session, transcript and
  evaluation; typed into a live call, the drill and the email lab; imported through a backup;
  and in URL path, query and hash. **No execution on any surface.** On the data-driven surfaces
  (home, library, progress, briefing, drill, live transcript, imported backup) the runs also
  proved the payload was actually *displayed as text*, so the tests were not passing vacuously.
  The URL-only cases never reflect the value into the page, so there was nothing to execute.
- **Content-Security-Policy** — zero violations during normal use including the service
  worker; inline script, external script and `fetch` to a foreign origin all blocked.
- **Clickjacking** — framing from another origin is blocked.
- **CSV injection** — 8 payload variants (`=`, `+`, `-`, `@`, tab, CR, DDE, multiline)
  neutralized.
- **ReDoS** — 11 adversarial 1 MB inputs (repeated characters, combining marks, emoji, long
  token runs) through the email analyzer and the drill scorer each finished under the 2.5 s
  threshold (only the threshold was asserted, not the exact times); about 4,000 seeded fuzz
  calls on those two functions never threw.
- **Score forging** — the model cannot set the overall score; it is recomputed server-side
  (`C1`, `C2`).
- **Secrets** — none in the working tree, in any commit, or in the production bundle; no
  source maps shipped.
- **Dependencies** — `npm audit`: 0 vulnerabilities; all 322 lockfile entries have an integrity
  hash and resolve from the official registry; only `esbuild` and `fsevents` run install
  scripts (both development-only and standard).
- **Row-level security (as written)** — without migration `0003` the static check reports
  exactly the three world-writable policies; with it, none.
- **Code review (not attack results):** no code path fetches a user-supplied URL (no SSRF), no
  shell execution, and database filters go through the parametrized client with a UUID-validated
  key.

## Hypotheses to validate — **not** confirmed

These depend on things the test environment cannot reach. They are listed so nobody mistakes
"not tested" for "safe".

| ID | Hypothesis | Why it is unverified | How to validate |
|---|---|---|---|
| H-1 | If the Supabase edge **appends** the client IP to `x-forwarded-for` instead of overwriting it, the leftmost value is attacker-controlled and the per-IP limit can be evaded. The code now prefers `cf-connecting-ip`, but whether that header exists on that platform is unknown. | Needs the live platform. | Call a deployed function with a forged `X-Forwarded-For` and inspect what it logs. |
| H-2 | Per-IP limits do not bound the **total** if an attacker rotates through many IPs (IPv6 /64 ranges are cheap). The only global backstop is the **Anthropic spend cap**. | Distributed abuse is not reproducible locally. | Confirm the spend cap exists (see below). |
| H-3 | A platform-level request-size or concurrency limit may exist in front of the functions and soften EF-1 and EF-7 further. | Platform behavior. | Supabase docs / a deployed test. |
| H-4 | The **live** database may differ from the migrations (edited in the dashboard, or `0003` never run). | The lint checks the repo's SQL, not your project. | Supabase → Authentication → Policies: no policy on `sessions`, `turns`, `evaluations`, `usage_events`. |
| H-5 | **Prompt injection** of the live model (roleplay/coach). | Needs a real model call; demo mode never reads the prompts. Mitigations in place: fixed model and token limits, no tools, no secrets in prompts, server-side score recompute. Residual impact is limited to the attacker's own session. | Manual red-team once the backend is live. |
| H-6 | Supabase Auth settings (redirect allowlist, SMTP, OTP rate limits) and the magic-link flow. | Needs a live project. | Review Authentication → URL Configuration. |
| H-7 | Package **provenance** (`npm audit signatures`). | The command failed to download in the test environment — a network limit, not a result. | Run `npm audit signatures` locally. |

## Worst-case cost per request

Measured, not guessed: the largest payload the validators still accept makes the function send
**30,318 bytes** to Anthropic for `/roleplay` and **45,193 bytes** for `/evaluate`.

At roughly 3–4 characters per token and the Haiku prices quoted in
`supabase/functions/_shared/common.ts` ($1 / $5 per million input / output tokens — check the
current price list), that is an **estimate** of about **$0.011** per roleplay turn and
**$0.02** per evaluation. With the default limits that bounds one device to roughly $1.5/day
($1.3 roleplay + $0.2 evaluate) and one IP to roughly $6/day. Before the fixes none of these bounds held: a single oversized
block, a concurrent burst, or a database hiccup each removed the cap.

## Limits of these tests

- Edge Function tests use a simulated runtime, not Deno itself. The logic is the real
  production code; the platform around it is not.
- A static migration check is not a database check (H-4).
- Passing tests show the absence of the *tested* attacks, not of all attacks.
