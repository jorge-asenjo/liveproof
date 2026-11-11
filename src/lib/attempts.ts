// Optional: save every verified attempt (frames + challenge + result) so it can be labelled
// and replayed by the eval script. Off by default. Two ways to turn it on:
//   - Local development: ATTEMPTS_DIR writes each attempt to a folder (any seller).
//   - Deployed: EVAL_CAPTURE_SELLERS (comma-separated PayPal payer ids) stores the attempts
//     of those sellers only in Postgres, for the team's own test accounts. Never list
//     anyone else: the frames show the person doing the proof.
// The attempts are read back with scripts/pull-attempts.ts (EVAL_EXPORT_TOKEN).
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sellerId, type Challenge } from "./challenge";
import { once, sql } from "./db";
import type { Seller } from "./session";

function localDir() {
  return process.env.NODE_ENV !== "production" ? process.env.ATTEMPTS_DIR : undefined;
}

function captureSellers() {
  return (process.env.EVAL_CAPTURE_SELLERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function evalCaptureEnabled(seller: Seller) {
  if (localDir()) return true;
  return !!sql && captureSellers().includes(sellerId(seller));
}

export type AttemptMeta = ReturnType<typeof buildMeta>;

function buildMeta(challenge: Challenge, files: { m1: string[]; m2: string[] }) {
  return {
    label: challenge.evalLabel?.label ?? null, // can be corrected by hand afterwards
    attack: challenge.evalLabel?.attack ?? null,
    notes: "",
    createdAt: new Date(challenge.createdAt).toISOString(),
    listing: challenge.listing,
    code: challenge.code,
    gestureA: challenge.gestureA,
    gestureB: challenge.gestureB,
    gestureBDelayMs: (challenge.moment2At ?? 0) - (challenge.gestureBIssuedAt ?? 0),
    files,
    live: { observation: challenge.observation, decision: challenge.decision, verify: challenge.verify, error: challenge.error },
  };
}

const initTable = once(
  () => sql!`create table if not exists eval_attempts (
    id text primary key,
    created_at timestamptz not null default now(),
    meta jsonb not null,
    frames jsonb not null
  )`,
);

export async function saveAttempt(challenge: Challenge) {
  if (!evalCaptureEnabled(challenge.seller)) return;
  const frames: Record<"m1" | "m2", string[]> = { m1: challenge.moment1 ?? [], m2: challenge.moment2 ?? [] };
  const files: Record<"m1" | "m2", string[]> = {
    m1: frames.m1.map((_, i) => `m1-${i}.jpg`),
    m2: frames.m2.map((_, i) => `m2-${i}.jpg`),
  };
  const meta = buildMeta(challenge, files);

  const dir = localDir();
  if (dir) {
    const stamp = new Date(challenge.createdAt).toISOString().replace(/[:.]/g, "-");
    const caseDir = path.join(dir, `${stamp}-${challenge.id}`);
    await mkdir(caseDir, { recursive: true });
    for (const moment of ["m1", "m2"] as const) {
      for (const [i, dataUrl] of frames[moment].entries()) {
        await writeFile(path.join(caseDir, files[moment][i]), Buffer.from(dataUrl.split(",")[1] ?? "", "base64"));
      }
    }
    await writeFile(path.join(caseDir, "meta.json"), JSON.stringify(meta, null, 2));
    return;
  }

  await initTable();
  await sql!`insert into eval_attempts (id, meta, frames)
    values (${challenge.id}, ${JSON.stringify(meta)}::jsonb, ${JSON.stringify(frames)}::jsonb)
    on conflict (id) do nothing`;
}

// For the export routes (token-protected). Newest first.
export async function listAttempts() {
  if (!sql) return [];
  await initTable();
  const rows = await sql`select id, created_at, meta->>'label' as label, meta->>'attack' as attack,
    meta->'live'->'decision'->>'passed' as passed from eval_attempts order by created_at desc limit 500`;
  return rows as { id: string; created_at: string; label: string | null; attack: string | null; passed: string | null }[];
}

export async function getAttempt(id: string) {
  if (!sql) return null;
  await initTable();
  const rows = await sql`select id, created_at, meta, frames from eval_attempts where id = ${id}`;
  return (rows[0] as { id: string; created_at: string; meta: AttemptMeta; frames: Record<"m1" | "m2", string[]> } | undefined) ?? null;
}

// Bearer token check for the export routes. Without EVAL_EXPORT_TOKEN they do not exist.
export function exportAuthorized(request: Request) {
  const token = process.env.EVAL_EXPORT_TOKEN;
  if (!token || token.length < 24) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${token}`));
}
