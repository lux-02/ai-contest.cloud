import "server-only";

import { Pool } from "pg";

declare global {
  var __aiContestPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL or DATABASE_URL is required for admin writes.");
  }

  return new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 5,
  });
}

export function getDbPool() {
  globalThis.__aiContestPool ??= createPool();
  return globalThis.__aiContestPool;
}
