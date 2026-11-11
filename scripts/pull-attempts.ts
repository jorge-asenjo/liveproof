// Downloads the eval attempts captured on the deployed app (EVAL_CAPTURE_SELLERS) into the
// local eval folder, in the same layout the eval script reads (meta.json + frames).
//
//   npx tsx scripts/pull-attempts.ts [destDir]
//
// Needs EVAL_EXPORT_TOKEN (same value as on the server) and optionally EVAL_EXPORT_URL in
// .env.local. Folders that already exist are skipped, so labels edited by hand are kept.
import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

process.loadEnvFile?.(".env.local");

const base = (process.env.EVAL_EXPORT_URL ?? "https://liveproof-j5u7.onrender.com").replace(/\/$/, "");
const token = process.env.EVAL_EXPORT_TOKEN;
const dest = process.argv[2] ?? process.env.ATTEMPTS_DIR ?? "../eval/attempts";

async function get(url: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function main() {
  if (!token) throw new Error("Set EVAL_EXPORT_TOKEN in .env.local");
  await mkdir(dest, { recursive: true });
  const existing = new Set((await readdir(dest)).map((name) => name.split("-").slice(-1)[0]));
  const { attempts } = (await get(`${base}/api/eval/attempts`)) as {
    attempts: { id: string; created_at: string; label: string | null; attack: string | null; passed: string | null }[];
  };
  let added = 0;
  for (const a of attempts) {
    const stamp = new Date(a.created_at).toISOString().replace(/[:.]/g, "-");
    const caseDir = path.join(dest, `${stamp}-${a.id}`);
    if (existing.has(a.id) || (await access(caseDir).then(() => true, () => false))) continue;
    const full = await get(`${base}/api/eval/attempts/${encodeURIComponent(a.id)}`);
    await mkdir(caseDir, { recursive: true });
    for (const moment of ["m1", "m2"] as const) {
      for (const [i, dataUrl] of (full.frames[moment] as string[]).entries()) {
        await writeFile(path.join(caseDir, full.meta.files[moment][i]), Buffer.from(dataUrl.split(",")[1] ?? "", "base64"));
      }
    }
    await writeFile(path.join(caseDir, "meta.json"), JSON.stringify(full.meta, null, 2));
    added++;
    console.log(`${a.label ?? "unlabelled"} ${a.attack ?? ""} passed=${a.passed} ${caseDir}`);
  }
  console.log(`${added} new, ${attempts.length} on the server`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
