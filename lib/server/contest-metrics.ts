import "server-only";

import { getDbPool } from "@/lib/server/db";

export async function registerContestView(contestId: string) {
  try {
    const pool = getDbPool();
    await pool.query(
      `
        update public.contests
        set view_count = coalesce(view_count, 0) + 1
        where id = $1
      `,
      [contestId],
    );
  } catch (error) {
    console.error("[contest-metrics] could not register view", error);
  }
}

export async function registerContestApply(contestId: string) {
  try {
    const pool = getDbPool();
    await pool.query(
      `
        update public.contests
        set apply_count = coalesce(apply_count, 0) + 1
        where id = $1
      `,
      [contestId],
    );
  } catch (error) {
    console.error("[contest-metrics] could not register apply click", error);
  }
}

