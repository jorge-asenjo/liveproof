// Optional: save every verified attempt (frames + challenge + result) to disk so it can
// be labelled and replayed by the eval script. Off unless ATTEMPTS_DIR is set.
// Never enable this in production: the frames show the seller.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Challenge } from "./challenge";

export async function saveAttempt(challenge: Challenge) {
  const dir = process.env.ATTEMPTS_DIR;
  if (!dir || process.env.NODE_ENV === "production") return;
  const stamp = new Date(challenge.createdAt).toISOString().replace(/[:.]/g, "-");
  const caseDir = path.join(dir, `${stamp}-${challenge.id}`);
  await mkdir(caseDir, { recursive: true });

  const frames: Record<string, string[]> = { m1: challenge.moment1 ?? [], m2: challenge.moment2 ?? [] };
  const files: Record<string, string[]> = { m1: [], m2: [] };
  for (const [moment, list] of Object.entries(frames)) {
    for (const [i, dataUrl] of list.entries()) {
      const name = `${moment}-${i}.jpg`;
      await writeFile(path.join(caseDir, name), Buffer.from(dataUrl.split(",")[1] ?? "", "base64"));
      files[moment].push(name);
    }
  }

  const meta = {
    label: null as null | "genuine" | "attack", // filled in by hand afterwards
    attack: null as null | string,
    notes: "",
    listing: challenge.listing,
    code: challenge.code,
    gestureA: challenge.gestureA,
    gestureB: challenge.gestureB,
    gestureBDelayMs: (challenge.moment2At ?? 0) - (challenge.gestureBIssuedAt ?? 0),
    files,
    live: { observation: challenge.observation, decision: challenge.decision, verify: challenge.verify, error: challenge.error },
  };
  await writeFile(path.join(caseDir, "meta.json"), JSON.stringify(meta, null, 2));
}
