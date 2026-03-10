# AI Contest Cloud

Luma-like AI contest discovery UI with a Supabase-backed data model for manual ingestion and GPT-generated contest analysis.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase (`contests`, `contest_badges`, `contest_ai_analysis`)

## Local Run

```bash
npm install
npm run dev
```

Add `.env.local` if you want live Supabase data:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_DB_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
ADMIN_SUPABASE_EMAIL=admin@example.com
ADMIN_SUPABASE_EMAILS=admin@example.com
ADMIN_SUPABASE_PASSWORD=...
```

Without env vars, the UI falls back to local seeded contests in [`lib/mock-contests.ts`](/Users/lux/Documents/ai-contest.cloud/lib/mock-contests.ts).

## Supabase

Run the schema in [`supabase/migrations/20260309183000_init_contest_platform.sql`](/Users/lux/Documents/ai-contest.cloud/supabase/migrations/20260309183000_init_contest_platform.sql).

If your `.env.local` is configured, you can push the schema and seed data with:

```bash
npm run supabase:sync
npm run analysis:backfill
```

Core flow:

1. Insert manual contest data into `contests`
2. Refresh computed badges via `refresh_contest_badges(...)`
3. Store GPT output in `contest_ai_analysis`
4. Surface data in the app through server-side queries in [`lib/queries.ts`](/Users/lux/Documents/ai-contest.cloud/lib/queries.ts)
5. Upload poster images to Supabase Storage `contest-posters` and store the public URL in `poster_image_url`

## Admin Ingest

Open [`/admin/contests`](/Users/lux/Documents/ai-contest.cloud/app/admin/contests/page.tsx) to manually register a contest.

- With `ADMIN_SUPABASE_EMAILS`, `/admin` routes are protected by Supabase Auth and only allowlisted admin users can enter.
- `npm run supabase:sync` seeds the allowlisted admin user into `auth.users`/`public.admin_users`. If `SUPABASE_SERVICE_ROLE_KEY` is present it uses `auth.admin.createUser()`, otherwise it falls back to `signUp + SQL confirm`.
- With `OPENAI_API_KEY`, the form saves the contest and generates analysis immediately.
- Without it, the contest is still saved and `contest_ai_analysis.analysis_status` is set to `pending`.
- If you connected the key later, run `npm run analysis:backfill` to fill existing pending analyses.
- `npm run supabase:sync` also provisions the `contest-posters` storage bucket, the `admin_users` allowlist table, and admin-only upload policies used by the image uploader.

## External AI Service

If you want contest strategy generation to run in a private backend instead of this public repo, configure:

```bash
NULL_TO_FULL_API_BASE_URL=http://127.0.0.1:8080
NULL_TO_FULL_API_JWT_SECRET=replace-with-shared-secret
NULL_TO_FULL_API_JWT_ISSUER=ai-contest.cloud
NULL_TO_FULL_API_JWT_AUDIENCE=null-to-full
NULL_TO_FULL_API_SCOPE=contest_strategy.generate
NULL_TO_FULL_API_TIMEOUT_MS=45000
```

When those env vars are present, [`/api/contests/[slug]/strategy-lab`](/Users/lux/Documents/ai-contest.cloud/app/api/contests/%5Bslug%5D/strategy-lab/route.ts) calls the private `Null-to-Full` API first and stores the returned strategy report + ranked sources in Supabase.
If the private backend is unavailable, it falls back to the local in-repo pipeline.
