# AI Contest Cloud

Luma-like AI contest discovery UI with a Supabase-backed data model for manual ingestion and GPT-generated contest analysis.

## Live

- App: [ai-contest-cloud.vercel.app](https://ai-contest-cloud.vercel.app)
- Admin: [ai-contest-cloud.vercel.app/admin/login](https://ai-contest-cloud.vercel.app/admin/login)

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase (`contests`, `contest_badges`, `contest_ai_analysis`)

## Current Contest Lineup

README also works as a lightweight public lineup page, similar to curated event repos.  
The latest details always live in the app, and the same snapshot is also exported to [`data/contests.json`](/Users/lux/Documents/ai-contest.cloud/data/contests.json) for external reuse.

<!-- lineup:start -->
### 마감임박
곧 닫히는 공모전부터 빠르게 확인할 수 있게 정리한 섹션입니다.

| Deadline | Contest | Organizer | Prize | Category |
| --- | --- | --- | --- | --- |
| 2026-03-14 | [OpenAI Safety Sprint](https://ai-contest-cloud.vercel.app/contests/openai-safety-sprint) | OpenAI Builders | ₩72,500,000 | LLM / 에이전트, AI 인프라 / 시스템 |
| 2026-03-16 | [Multimodal Studio Jam](https://ai-contest-cloud.vercel.app/contests/multimodal-studio-jam) | Creator Tools Collective | ₩21,750,000 | 멀티모달 AI, 생성형 AI |

### 상금순
총상금 규모가 큰 순서대로 상위 라인업을 모았습니다.

| Deadline | Contest | Organizer | Prize | Category |
| --- | --- | --- | --- | --- |
| 2026-03-14 | [OpenAI Safety Sprint](https://ai-contest-cloud.vercel.app/contests/openai-safety-sprint) | OpenAI Builders | ₩72,500,000 | LLM / 에이전트, AI 인프라 / 시스템 |
| 2026-04-12 | [Healthcare AI Signal Cup](https://ai-contest-cloud.vercel.app/contests/healthcare-ai-signal-cup) | MediSignal Foundation | ₩43,500,000 | 데이터 사이언스, 사회문제 해결 AI |
| 2026-04-05 | [Vision for Climate Challenge](https://ai-contest-cloud.vercel.app/contests/vision-for-climate) | Earth Compute Lab | ₩36,250,000 | 컴퓨터 비전, 사회문제 해결 AI |
| 2026-03-16 | [Multimodal Studio Jam](https://ai-contest-cloud.vercel.app/contests/multimodal-studio-jam) | Creator Tools Collective | ₩21,750,000 | 멀티모달 AI, 생성형 AI |
| 2026-03-25 | [RoboOps Field Test](https://ai-contest-cloud.vercel.app/contests/roboops-field-test) | Autonomy Works | ₩17,400,000 | 로보틱스, AI 인프라 / 시스템 |

### 대학생 추천
학생 포트폴리오와 첫 지원 경험에 잘 맞는 대회를 우선 모았습니다.

| Deadline | Contest | Organizer | Prize | Category |
| --- | --- | --- | --- | --- |
| 2026-03-14 | [OpenAI Safety Sprint](https://ai-contest-cloud.vercel.app/contests/openai-safety-sprint) | OpenAI Builders | ₩72,500,000 | LLM / 에이전트, AI 인프라 / 시스템 |
| 2026-03-21 | [Campus RAG League](https://ai-contest-cloud.vercel.app/contests/campus-rag-league) | Korea AI Student Network | ₩8,700,000 | LLM / 에이전트, 사회문제 해결 AI |
| 2026-04-03 | [폭스바겐 골프 GTI 대학생 AI 영상 광고 공모전](https://ai-contest-cloud.vercel.app/contests/gti-ai) | 이오스커뮤니케이션스 | ₩580,000 | 생성형 AI |
| 2026-04-05 | [Vision for Climate Challenge](https://ai-contest-cloud.vercel.app/contests/vision-for-climate) | Earth Compute Lab | ₩36,250,000 | 컴퓨터 비전, 사회문제 해결 AI |
<!-- lineup:end -->

## Local Run

```bash
npm install
npm run dev
```

Refresh the public README lineup and `data/contests.json` export from Supabase:

```bash
node --env-file=.env.local --import tsx scripts/update-readme-lineup.ts
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

## GitHub Actions

This repo includes a daily GitHub Actions workflow that refreshes the `Current Contest Lineup` section in `README.md` and also regenerates [`data/contests.json`](/Users/lux/Documents/ai-contest.cloud/data/contests.json).

Set these repository secrets before enabling the workflow:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
