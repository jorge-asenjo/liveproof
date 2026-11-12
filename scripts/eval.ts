// Replays the verification on saved, labelled attempts and reports how many genuine
// proofs pass and how many attacks are rejected.
//
//   npx tsx scripts/eval.ts [casesDir] [--model claude-haiku-5-5] [--concurrency 3]
//                           [--filter text] [--out results.json]
//
// Each case folder (written by the app when ATTEMPTS_DIR is set) has meta.json and frames.
// Set "label" to "genuine" or "attack" (and "attack" to a short type) before running;
// unlabelled cases are skipped.
//
// Replays (an old proof sent for a new code, made by scripts/derive-attacks.ts) mostly test
// that Claude reads the code it sees: Claude never gets the expected code, so a replay only
// passes if two random codes collide (1 in 23^5 = 6.4 million) or Claude misreads.
// Cases that end in an error are reported apart, never counted as rejected attacks.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GESTURE_B_SHOWN_MS, GESTURE_B_WINDOW_MS } from "../src/lib/challenge";
import type { Gesture } from "../src/lib/gestures";
import { decide, observe } from "../src/lib/verify";

process.loadEnvFile?.(".env.local");

type Meta = {
  label: "genuine" | "attack" | null;
  attack: string | null;
  notes?: string;
  listing: { title: string; category: string; proof_detail: string };
  code: string;
  gestureA: Gesture;
  gestureB: Gesture;
  gestureBDelayMs: number;
  files: { m1: string[]; m2: string[] };
};

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const model = flag("--model") ?? process.env.VERIFY_MODEL ?? "claude-opus-5-5";
const concurrency = Number(flag("--concurrency") ?? 3);
const filter = flag("--filter");
const out = flag("--out");
const effort = flag("--effort") as "low" | "medium" | "high" | undefined;
const dir = args[0] ?? process.env.ATTEMPTS_DIR ?? "../eval/attempts";

async function toDataUrl(file: string) {
  return "data:image/jpeg;base64," + (await readFile(file)).toString("base64");
}

type Row = {
  name: string;
  label: string;
  attack: string;
  correct: boolean;
  passed: boolean;
  flagged: boolean; // passed, but with an amber warning the buyer sees
  failed: string;
  latencyMs: number;
  costUsd: number;
  error?: string;
  observation?: unknown;
};

async function runCase(name: string): Promise<Row | null> {
  const caseDir = path.join(dir, name);
  const meta = JSON.parse(await readFile(path.join(caseDir, "meta.json"), "utf8")) as Meta;
  if (meta.label !== "genuine" && meta.label !== "attack") return null;
  const base = { name, label: meta.label, attack: meta.attack ?? "" };
  try {
    const moment1 = await Promise.all(meta.files.m1.map((f) => toDataUrl(path.join(caseDir, f))));
    const moment2 = await Promise.all(meta.files.m2.map((f) => toDataUrl(path.join(caseDir, f))));
    const result = await observe({ listing: meta.listing, moment1, moment2, model, effort });
    const decision = decide(
      {
        listingModel: (meta.listing as { model?: string | null }).model ?? null,
        code: meta.code,
        gestureA: meta.gestureA,
        gestureB: meta.gestureB,
        gestureBDelayMs: meta.gestureBDelayMs,
        gestureBWindowMs: GESTURE_B_WINDOW_MS,
        gestureBShownMs: GESTURE_B_SHOWN_MS,
      },
      result.observation,
    );
    const failed = decision.checks.filter((c) => c.hard && !c.ok).map((c) => c.id + (c.detail ? ` (${c.detail})` : ""));
    return {
      ...base,
      passed: decision.passed,
      flagged: decision.passed && decision.checks.some((c) => c.ok && c.warn),
      correct: decision.passed === (meta.label === "genuine"),
      failed: failed.join(", "),
      latencyMs: result.latencyMs,
      costUsd: result.costUsd ?? 0,
      observation: result.observation,
    };
  } catch (err) {
    return { ...base, passed: false, flagged: false, correct: false, failed: "", latencyMs: 0, costUsd: 0, error: String(err) };
  }
}

async function main() {
  const names = (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory() && (!filter || d.name.includes(filter))).map((d) => d.name).sort();
  const rows: Row[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < names.length) {
        const row = await runCase(names[next++]);
        if (row) {
          rows.push(row);
          console.log(`${row.correct ? "ok  " : "MISS"} ${row.label.padEnd(7)} ${row.attack.padEnd(14)} ${row.passed ? (row.flagged ? "PASS!" : "PASS ") : "FAIL "} ${(row.latencyMs / 1000).toFixed(1)}s  ${row.name}${row.failed ? `  [${row.failed}]` : ""}${row.error ? `  ERROR ${row.error}` : ""}`);
        }
      }
    }),
  );

  const genuine = rows.filter((r) => r.label === "genuine" && !r.error);
  const attacks = rows.filter((r) => r.label === "attack" && !r.error);
  const latencies = rows.filter((r) => r.latencyMs > 0).map((r) => r.latencyMs).sort((a, b) => a - b);
  const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))] ?? 0;
  console.log(`\nModel: ${model}`);
  console.log(`Genuine proofs accepted: ${genuine.filter((r) => r.passed).length}/${genuine.length}`);
  console.log(`Attacks rejected: ${attacks.filter((r) => !r.passed).length}/${attacks.length}`);
  console.log(`Attacks that passed with an amber warning to the buyer: ${attacks.filter((r) => r.flagged).length}; passed with no warning: ${attacks.filter((r) => r.passed && !r.flagged).length}`);
  console.log(`Genuine proofs that passed with a warning: ${genuine.filter((r) => r.flagged).length}`);
  const byType = new Map<string, Row[]>();
  for (const r of attacks) byType.set(r.attack || "unspecified", [...(byType.get(r.attack || "unspecified") ?? []), r]);
  for (const [type, list] of byType) {
    const flagged = list.filter((r) => r.flagged).length;
    console.log(`  ${type}: ${list.filter((r) => !r.passed).length}/${list.length} rejected${flagged ? `, ${flagged} passed with a warning` : ""}`);
  }
  console.log(`Verification time: median ${(pct(0.5) / 1000).toFixed(1)} s, p90 ${(pct(0.9) / 1000).toFixed(1)} s`);
  console.log(`Cost: $${rows.reduce((s, r) => s + r.costUsd, 0).toFixed(3)} total, $${(rows.reduce((s, r) => s + r.costUsd, 0) / Math.max(1, rows.length)).toFixed(4)} per proof`);
  const errors = rows.filter((r) => r.error).length;
  if (errors) console.log(`Errors: ${errors}`);
  if (out) {
    await writeFile(out, JSON.stringify({ model, ranAt: new Date().toISOString(), rows: rows.sort((a, b) => a.name.localeCompare(b.name)) }, null, 2));
    console.log(`Wrote ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
