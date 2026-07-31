# Deploying Focolare to Vercel

Everything in the codebase is ready. This is what *you* need to do — the steps
involve accounts, secrets, and billing, so they can't be automated from here.

---

## Plan requirements — you're covered

This project targets **Vercel Pro**, which you have. That matters for one reason:

`vercel.json` schedules `/api/cron/dispatch` **every minute**, which is what makes
cook timers fire on time. Pro allows minute-granularity crons; Hobby caps them at
once per day, which would break the feature entirely. Nothing to change.

That cron runs ~1,440 times a day. Each run is a single indexed query for due
events and returns immediately when there are none, so it's cheap — but keep it
that way if you extend the dispatcher.

If you ever need to move off Vercel cron, `/api/cron/dispatch` also accepts a
`CRON_SECRET` bearer token, so any external scheduler can drive it.

---

## 1. Postgres

Your local database is Docker; production needs a hosted one. Any Postgres works —
[Neon](https://neon.tech) has a usable free tier and pairs well with Vercel.

1. Create the database.
2. Copy the **pooled** connection string. Serverless functions open many short-lived
   connections, and a direct (unpooled) string will exhaust connection limits under
   load. Neon's is the one containing `-pooler`.
3. Keep it for `DATABASE_URL` below.

## 2. Vercel project

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo. It auto-detects Next.js;
   leave the build settings alone.
3. Don't deploy yet — set environment variables first (next step), otherwise the
   first build will fail on a missing `DATABASE_URL`.

## 3. Blob storage (required)

Uploads **cannot** go to disk on Vercel — the filesystem is ephemeral, so images
would vanish between requests. The app switches to CDN-backed object storage
automatically when a Blob store is attached.

1. In your Vercel project: **Storage → Create Database → Blob**.
2. Connect it to the project.
3. Vercel injects `BLOB_READ_WRITE_TOKEN` automatically — you don't set it by hand.
   Its presence is what flips the app from local disk to Blob.

## 4. Environment variables

Set these in **Settings → Environment Variables** (Production, and Preview if you
use preview deploys). See `.env.example` for the full annotated list.

**Required:**

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Pooled connection string from step 1 |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` — there is a dev fallback in code, so an unset value means forgeable sessions |
| `BETTER_AUTH_URL` | Your real origin, e.g. `https://focolare.app` |
| `NEXT_PUBLIC_APP_URL` | Same origin |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `ADMIN_EMAILS` | The email you sign in with, or you can't reach `/admin` |

**Required for a real launch:**

| Variable | Why |
|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Password-reset emails. Without SMTP, a user who forgets their password is permanently locked out — the link only goes to the server log. |

**Optional:**

| Variable | Effect if unset |
|---|---|
| `OPENAI_API_KEY` | AI import/generation panels are hidden, and **content moderation is skipped** — submissions publish unscreened |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push off (`npx web-push generate-vapid-keys`) |
| `TWILIO_*` | SMS alerts off (they're paid-plan-only anyway) |

## 5. Deploy, then seed

1. Deploy from the Vercel dashboard.

   **Migrations run automatically.** Vercel uses the `vercel-build` script, which
   applies every file in `drizzle/` before building. Shipping code whose schema
   is missing was the single most common failure while building this app — the
   symptom is a 500 with `column "x" does not exist` — so it is no longer a
   step anyone has to remember.

   A failed migration fails the build, deliberately: better a deploy that does
   not land than one serving errors. You can still run it by hand against any
   database:

   ```bash
   DATABASE_URL="<your production pooled url>" npm run db:migrate
   ```

2. Seed the taxonomy (categories are required to publish a recipe):

   ```bash
   DATABASE_URL="<your production pooled url>" npm run db:seed
   ```

   `db:seed` creates categories only. Demo recipes live behind
   `db:seed:recipes` and should not be run against production.

## 6. Verify

- [ ] Home page loads and shows categories
- [ ] Sign up, then sign out and sign back in
- [ ] **Forgot password** → email arrives → link sets a new password
- [ ] Create a recipe with a photo — confirm the image URL is
      `…public.blob.vercel-storage.com`, not `/api/files/…`
- [ ] `/admin/moderation` is reachable with your `ADMIN_EMAILS` account
- [ ] Start a cook session with a short timer and confirm the notification arrives
      (this is the one that needs the every-minute cron)

## 7. Domain

**Settings → Domains**, add your domain, follow the DNS instructions. Afterwards
update `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the new origin and redeploy —
auth callbacks and emailed links are built from those values.

---

## Notes

**Local development is unchanged.** Without `BLOB_READ_WRITE_TOKEN`, uploads keep
writing to `.data/uploads` and serving from `/api/files`, so you don't need a Vercel
account to run the app.

**Existing local images won't migrate.** Anything already in `.data/uploads` stays
on your machine; production starts with an empty Blob store. Recipes seeded from
`public/recipes/*.jpg` are committed to the repo, so those keep working.

**Cost watch.** OpenAI image generation is the only meaningfully priced call — the
free plan allows 1/month per user and pro 30 (`PLAN_LIMITS` in
`src/lib/entitlements.ts`). Check that against your pricing before opening signups.
