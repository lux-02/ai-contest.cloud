import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

import { getAdminEmailAllowlist } from "../lib/admin-auth";
import { mockContests } from "../lib/mock-contests";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const migrationsDirectory = path.join(projectRoot, "supabase", "migrations");

async function getMigrationFiles() {
  const entries = await readdir(migrationsDirectory);
  return entries.filter((entry) => entry.endsWith(".sql")).sort();
}

async function ensureMigrationTable(client: Client) {
  await client.query(`
    create table if not exists public.app_schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default timezone('utc', now())
    )
  `);
}

async function markBootstrapMigrationIfNeeded(client: Client, filename: string) {
  const existingContestsTable = await client.query<{ exists: boolean }>(`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'contests'
    ) as exists
  `);

  if (!existingContestsTable.rows[0]?.exists) {
    return;
  }

  await client.query(
    `
      insert into public.app_schema_migrations (filename)
      values ($1)
      on conflict (filename) do nothing
    `,
    [filename],
  );
}

async function applyPendingMigrations(client: Client) {
  await ensureMigrationTable(client);

  const migrationFiles = await getMigrationFiles();

  if (migrationFiles.length === 0) {
    return;
  }

  await markBootstrapMigrationIfNeeded(client, migrationFiles[0]);

  const appliedResult = await client.query<{ filename: string }>("select filename from public.app_schema_migrations");
  const applied = new Set(appliedResult.rows.map((row) => row.filename));

  for (const filename of migrationFiles) {
    if (applied.has(filename)) {
      continue;
    }

    const migrationSql = await readFile(path.join(migrationsDirectory, filename), "utf8");

    await client.query("begin");

    try {
      await client.query(migrationSql);
      await client.query(
        `
          insert into public.app_schema_migrations (filename)
          values ($1)
        `,
        [filename],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
}

function getSupabaseAuthSeedConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const adminEmail = getAdminEmailAllowlist()[0] ?? "";
  const adminPassword = process.env.ADMIN_SUPABASE_PASSWORD ?? "";

  if (!url || !publishableKey || !adminEmail || !adminPassword) {
    return null;
  }

  return {
    url,
    publishableKey,
    serviceRoleKey,
    adminEmail,
    adminPassword,
  };
}

async function ensureSupabaseAdminUser(client: Client) {
  const config = getSupabaseAuthSeedConfig();

  if (!config) {
    return null;
  }

  const existingAdmin = await client.query<{ id: string }>(
    `
      select id
      from auth.users
      where email = $1
        and deleted_at is null
      limit 1
    `,
    [config.adminEmail],
  );

  let adminUserId: string | null = existingAdmin.rows[0]?.id ?? null;

  if (!adminUserId) {
    if (config.serviceRoleKey) {
      const serviceClient = createClient(config.url, config.serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const { data, error } = await serviceClient.auth.admin.createUser({
        email: config.adminEmail,
        password: config.adminPassword,
        email_confirm: true,
      });

      if (error) {
        throw new Error(`Could not create the Supabase admin user: ${error.message}`);
      }

      adminUserId = data.user.id;
    } else {
      const authClient = createClient(config.url, config.publishableKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const { data, error } = await authClient.auth.signUp({
        email: config.adminEmail,
        password: config.adminPassword,
      });

      if (error) {
        throw new Error(
          `Could not create the Supabase admin user without a service role key: ${error.message}`,
        );
      }

      adminUserId = data.user?.id ?? null;
    }
  }

  if (!adminUserId) {
    const resolvedAdmin = await client.query<{ id: string }>(
      `
        select id
        from auth.users
        where email = $1
          and deleted_at is null
        limit 1
      `,
      [config.adminEmail],
    );

    adminUserId = resolvedAdmin.rows[0]?.id ?? null;
  }

  if (!adminUserId) {
    throw new Error("Could not resolve the Supabase admin user id after auth provisioning.");
  }

  await client.query(
    `
      update auth.users
      set
        email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
        raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', array['email'])
      where id = $1
    `,
    [adminUserId],
  );

  await client.query(
    `
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      select
        gen_random_uuid(),
        $1::uuid,
        jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true),
        'email',
        $2::text,
        null,
        timezone('utc', now()),
        timezone('utc', now())
      where not exists (
        select 1
        from auth.identities
        where user_id = $1::uuid
          and provider = 'email'
      )
    `,
    [adminUserId, config.adminEmail],
  );

  await client.query(
    `
      insert into public.admin_users (user_id, email)
      values ($1, $2)
      on conflict (user_id) do update
      set email = excluded.email
    `,
    [adminUserId, config.adminEmail],
  );

  return adminUserId;
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL or DATABASE_URL is required.");
  }

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();

  try {
    await applyPendingMigrations(client);
    try {
      await ensureSupabaseAdminUser(client);
    } catch (error) {
      if (
        error instanceof Error &&
        /email rate limit exceeded/i.test(error.message) &&
        !process.env.SUPABASE_SERVICE_ROLE_KEY
      ) {
        console.warn(
          "Admin auth provisioning is deferred because Supabase email signup is rate-limited. Add SUPABASE_SERVICE_ROLE_KEY or rerun `npm run supabase:sync` after the rate limit clears.",
        );
      } else {
        throw error;
      }
    }

    await client.query("begin");

    for (const contest of mockContests) {
      const contestResult = await client.query<{
        id: string;
      }>(
        `
          insert into public.contests (
            slug,
            title,
            organizer,
            short_description,
            description,
            url,
            source,
            source_url,
            poster_image_url,
            apply_url,
            start_date,
            deadline,
            event_date,
            participation_mode,
            location,
            eligibility_text,
            eligibility_segments,
            difficulty,
            team_allowed,
            min_team_size,
            max_team_size,
            language,
            global_participation,
            prize_pool_krw,
            prize_summary,
            submission_format,
            tools_allowed,
            dataset_provided,
            dataset_summary,
            ai_categories,
            tags,
            status
          )
          values (
            $1, $2, $3, $4, $5, $6, 'manual', $7, $8, $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
          )
          on conflict (slug) do update
          set
            title = excluded.title,
            organizer = excluded.organizer,
            short_description = excluded.short_description,
            description = excluded.description,
            url = excluded.url,
            source_url = excluded.source_url,
            poster_image_url = excluded.poster_image_url,
            apply_url = excluded.apply_url,
            start_date = excluded.start_date,
            deadline = excluded.deadline,
            event_date = excluded.event_date,
            participation_mode = excluded.participation_mode,
            location = excluded.location,
            eligibility_text = excluded.eligibility_text,
            eligibility_segments = excluded.eligibility_segments,
            difficulty = excluded.difficulty,
            team_allowed = excluded.team_allowed,
            min_team_size = excluded.min_team_size,
            max_team_size = excluded.max_team_size,
            language = excluded.language,
            global_participation = excluded.global_participation,
            prize_pool_krw = excluded.prize_pool_krw,
            prize_summary = excluded.prize_summary,
            submission_format = excluded.submission_format,
            tools_allowed = excluded.tools_allowed,
            dataset_provided = excluded.dataset_provided,
            dataset_summary = excluded.dataset_summary,
            ai_categories = excluded.ai_categories,
            tags = excluded.tags,
            status = excluded.status
          returning id
        `,
        [
          contest.slug,
          contest.title,
          contest.organizer,
          contest.shortDescription,
          contest.description,
          contest.url,
          contest.sourceUrl ?? null,
          contest.posterImageUrl ?? null,
          contest.applyUrl ?? contest.url,
          contest.startDate ?? null,
          contest.deadline ?? null,
          contest.eventDate ?? null,
          contest.participationMode,
          contest.location ?? null,
          contest.eligibilityText,
          contest.eligibilitySegments,
          contest.difficulty,
          contest.teamAllowed,
          contest.minTeamSize,
          contest.maxTeamSize,
          contest.language,
          contest.globalParticipation,
          contest.prizePoolKrw ?? null,
          contest.prizeSummary ?? null,
          contest.submissionFormat ?? null,
          contest.toolsAllowed,
          contest.datasetProvided,
          contest.datasetSummary ?? null,
          contest.aiCategories,
          contest.tags,
          contest.status,
        ],
      );

      const contestId = contestResult.rows[0]?.id;

      if (!contestId) {
        throw new Error(`Could not resolve contest id for ${contest.slug}`);
      }

      await client.query(
        `
          insert into public.contest_ai_analysis (
            contest_id,
            summary,
            recommend_reason,
            win_strategy,
            difficulty_analysis,
            judging_focus,
            prompt_version,
            model_name,
            analysis_status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          on conflict (contest_id) do update
          set
            summary = excluded.summary,
            recommend_reason = excluded.recommend_reason,
            win_strategy = excluded.win_strategy,
            difficulty_analysis = excluded.difficulty_analysis,
            judging_focus = excluded.judging_focus,
            prompt_version = excluded.prompt_version,
            model_name = excluded.model_name,
            analysis_status = excluded.analysis_status
        `,
        [
          contestId,
          contest.analysis.summary,
          contest.analysis.recommendReason,
          contest.analysis.winStrategy,
          contest.analysis.difficultyAnalysis,
          contest.analysis.judgingFocus,
          contest.analysis.promptVersion ?? "contest-v1",
          contest.analysis.modelName ?? null,
          contest.analysis.analysisStatus,
        ],
      );

      await client.query("select public.refresh_contest_badges($1)", [contestId]);
    }

    await client.query("commit");
    console.log(`Supabase sync complete: ${mockContests.length} contests upserted.`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  if (error instanceof Error && /ENOTFOUND/.test(error.message)) {
    console.error(
      "Could not resolve the provided DB host. Supabase direct connections are IPv6-only by default. Use the shared pooler connection string from Connect, or run this script from an IPv6-capable environment.",
    );
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
