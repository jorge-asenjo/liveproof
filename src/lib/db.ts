// Postgres (Neon) client, or null when DATABASE_URL is not set (local development).
// Server-only.
import { neon } from "@neondatabase/serverless";

export const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

// Runs a CREATE TABLE once per process; retried on the next call if it failed.
export function once(create: () => Promise<unknown>) {
  let ready: Promise<unknown> | null = null;
  return () =>
    (ready ??= create().catch((err) => {
      ready = null;
      throw err;
    }));
}
