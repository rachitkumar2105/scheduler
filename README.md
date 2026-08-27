# Scheduler

A personal schedule + email reminder app. Add exams, deadlines, and meetings; get emailed automatically before each one, plus a daily 9:00 AM IST digest.

## Reminder intervals

Each item picks one of two modes when you add it:

- **Automatic** (default): 24h, 12h, 6h, 2h, 1h, 30m before
- **Custom**: pick any subset of 48h, 24h, 12h, 6h, 3h, 1h, 30m, 15m (up to all 8)

If an item is added with less lead time than its largest interval (e.g. only 5h left when 24h/12h/6h are configured), or if the reminders cron didn't run for a while, those "already past" slots don't just get silently dropped — but they also don't each send their own email. Every cron run sends **at most one** email per item: the smallest crossed-but-unsent interval. If it crossed within this run it uses its own clean label ("2h left"); if it crossed earlier (item added late, or a cron gap) it reports the real time left instead ("17h 43m left"). Every other crossed interval for that item is silently marked sent in the same pass, so you never get a pile of redundant catch-up emails for one item at once — and the smaller intervals still ahead (2h, 1h, 30m) keep firing normally at their exact moments.

## Priority and the Plan tab

Every item has a priority — Low, Medium, or High — set when you add it and editable any time afterward from its card. The **Plan** tab uses it to suggest a working order: items are ranked by `minutes remaining ÷ priority weight` (High = ×3, Medium = ×2, Low = ×1), so a High-priority item pulls earlier even if a lower-priority one is nominally more imminent, without ever ignoring a genuinely close deadline. It's a deterministic ranking, not an AI suggestion — reliable and instant, no extra API calls.

## Email subjects

The subject line always uses the item's **exact title** — never AI-paraphrased — plus how much time is left, e.g. `Google Form — 2h left! Hurry.` or `DBMS Exam — 24h left`. That way a glance at the inbox (or notification banner) tells you exactly what's due and how urgent it is, without opening the email. Only the one-line body underneath is optionally written by AI, and the email always also prints the exact IST date/time (📅 line) regardless of what the AI wrote, so the concrete deadline is never left out.

## Daily digest (9:00 AM IST)

One email a day, always exactly one (never duplicated with the old 8 AM version — that's been replaced). It has two deterministic, always-accurate sections — **Today** and **Next 48 hours** (no overlap between them) — each listing every item's exact title, priority, and IST date/time. An optional short AI-written opening line sits on top as a friendly framing ("Good morning! Focus on X first — everything else has more room."), but the task list and deadlines themselves are never AI-generated, so a bad or garbled completion can never misstate a date.

## Stack

- **Frontend/backend:** Next.js (App Router) + Tailwind CSS
- **Database:** Neon (serverless Postgres)
- **Email:** Resend, with optional Groq-generated short copy (reminder one-liner, digest opener). Falls back to a plain static line if Groq is unset or fails — email delivery never depends on it. Two Groq API keys can be configured; each key attempt is a full independent completion, never a partial resume, so a mid-generation key switch can't corrupt or splice text — if the first key's calls fail, the second one regenerates the whole thing from scratch.
- **Scheduler:** an external cron service hits `/api/cron/reminders` every 5 minutes; Vercel's built-in Cron handles the once-daily 9 AM digest
- **Auth:** a single shared passphrase (no accounts) — see below
- **Timezone:** all scheduling and display uses IST (Asia/Kolkata)

## Why reminders don't use Vercel Cron

Vercel's free Hobby plan only allows cron jobs to run **once per day** — a 5-minute cadence isn't possible without upgrading to Pro. Since reliability is the priority here, the reminders check instead runs on a free external cron service ([cron-job.org](https://cron-job.org)) that pings the API every 5 minutes. This is more reliable in practice, and free. The digest, which only needs to run once a day, uses Vercel's built-in Cron via `vercel.json`.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in the values (see below for where to get each one).
3. Create the database tables (one-time):
   ```bash
   node --env-file=.env.local scripts/init-db.mjs
   ```
4. Run the dev server:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000 — you'll be asked for the passphrase you set as `APP_PASSWORD`.

## Environment variables

See `.env.example` for the full list with comments. Summary:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon dashboard → your project → "Connection string" (make sure "Show password" is on) |
| `RESEND_API_KEY` | resend.com → API Keys → Create API Key |
| `REMINDER_TO_EMAIL` | Your own email address |
| `REMINDER_FROM_EMAIL` | Leave as the default `onboarding@resend.dev` unless you've verified your own domain in Resend |
| `GROQ_API_KEY` | Optional. console.groq.com → API Keys. Writes the short one-line email body; omit it and a static line is used instead |
| `GROQ_API_KEY_2` | Optional second Groq key, used automatically if the first one's calls start failing |
| `APP_PASSWORD` | Any passphrase you choose — required once per browser to view/edit your schedule |
| `CRON_SECRET` | Any random string you generate (`openssl rand -base64 32`) — authenticates cron requests |

## Deploying to Vercel

1. Push this project to a GitHub repo (or deploy directly from the CLI — either works).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo (or run `npx vercel` from this directory).
3. Before the first deploy, add all the environment variables from `.env.example` under **Project Settings → Environment Variables** (values from the table above). Add them for the **Production** environment at minimum.
4. Deploy. Vercel will automatically pick up `vercel.json` and schedule the daily digest cron.
5. Once deployed, run the schema migration against your **production** database (same Neon DB, so you likely already did this in local setup — skip if so). If you used a separate database for production, run:
   ```bash
   node --env-file=.env.production.local scripts/init-db.mjs
   ```
6. Visit your deployed URL and log in with your `APP_PASSWORD` to confirm it works.

### Setting up the 5-minute reminder check (cron-job.org)

1. Go to [cron-job.org](https://cron-job.org) and create a free account.
2. Create a new cron job:
   - **URL:** `https://your-app.vercel.app/api/cron/reminders`
   - **Schedule:** every 5 minutes
   - **Request method:** GET
   - Under **Advanced → Headers**, add a custom header:
     - Name: `Authorization`
     - Value: `Bearer <your CRON_SECRET value>`
3. Save and enable it. You can trigger it manually once from the cron-job.org dashboard to confirm it returns `{"ok":true,"sent":0}` (or more, if something's actually due).

### Confirming the daily digest cron

Vercel's cron dashboard (**Project → Cron Jobs** tab) shows the `/api/cron/digest` job and its last run status. It's scheduled for `30 3 * * *` (UTC), which is 9:00 AM IST.

## Automatic cleanup

Every reminders cron run (every 5 minutes) also deletes events whose time has passed by more than an hour. The main list only ever shows upcoming events anyway, so this just keeps the database from accumulating old rows — nothing you need to manage.

## How reminder de-duplication works

Each schedule item can trigger at most one email per interval it's configured with. A `reminder_log` table with a `UNIQUE (item_id, interval_minutes)` constraint and an `INSERT ... ON CONFLICT DO NOTHING` claim ensures a reminder is never sent twice, even if the cron overlaps or retries. The same pattern (`digest_log`, unique per date) prevents duplicate digest emails.

## Project structure

```
app/
  page.tsx                  Main list + add form (server component)
  login/page.tsx            Passphrase entry
  api/items/route.ts        GET list, POST create
  api/items/[id]/route.ts   DELETE, PATCH (priority)
  api/login/route.ts        Verifies passphrase, sets session cookie
  api/cron/reminders/route.ts  Checks each item's own reminder intervals, sends at most one catch-up-aware email per item, deletes past events
  api/cron/digest/route.ts     Sends the once-daily 9 AM IST digest (Today + Next 48 hours)
components/
  ScheduleApp.tsx            Client-side UI: header, next-up card, tabs, add form, item list, plan view
lib/
  db.ts                      Neon queries
  email.ts                   Resend sending + subject/body composition
  groq.ts                    Optional AI-generated short email copy, with full-retry 2-key fallback
  constants.ts                Reminder interval, priority options + labels (shared by backend and UI)
  time.ts                    IST <-> UTC conversion helpers
  auth.ts                    Session cookie hashing
proxy.ts                     Auth gate (Next.js 16 middleware convention)
db/schema.sql                Table definitions
scripts/init-db.mjs          One-time schema setup script
vercel.json                  Digest cron schedule
```
