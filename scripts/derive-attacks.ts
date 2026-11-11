// Builds attack cases from genuine attempts: the same real frames, presented for a
// challenge they do not satisfy. This is what a scammer can do with a real proof they
// copied, or with a real item that is not the one in the listing.
//
//   npx tsx scripts/derive-attacks.ts [casesDir]
//
// For every case labelled "genuine" (and not derived itself) it writes:
//   replay        the old frames sent for a new random code and new gestures
//   other_item    the frames checked against a listing for a different kind of item (x2)
//   other_model   the frames checked against a listing for another model of the same kind
//                 (only when the category has one below)
//   wrong_gesture the first or the surprise gesture asked differs from the one shown
// Existing derived folders are kept, so the set is stable between runs.
import { randomInt } from "node:crypto";
import { access, copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CHALLENGE_GESTURES, type Gesture } from "../src/lib/gestures";

const dir = process.argv[2] ?? "../eval/attempts";
const CODE_ALPHABET = "ACDEFHJKMNPRTUVWXY34679";

type Listing = { title: string; category: string; brand: string | null; model: string | null; price: number | null; currency: string; condition: string | null; proof_detail: string };

const OTHER_ITEMS: Listing[] = [
  { title: "Sony WH-1000XM5 Wireless Headphones", category: "headphones", brand: "Sony", model: "WH-1000XM5", price: 220, currency: "USD", condition: "Used, like new", proof_detail: "the serial number label inside the left ear cup" },
  { title: "NVIDIA GeForce RTX 3080 Founders Edition", category: "graphics card", brand: "NVIDIA", model: "RTX 3080 FE", price: 450, currency: "USD", condition: "Used, never mined", proof_detail: "the model sticker on the back of the card" },
  { title: "Nintendo Switch OLED Console", category: "game console", brand: "Nintendo", model: "Switch OLED", price: 250, currency: "USD", condition: "Used, with dock", proof_detail: "the serial number sticker on the bottom of the console" },
  { title: "Rolex Submariner Date 126610LN", category: "wristwatch", brand: "Rolex", model: "126610LN", price: 11500, currency: "USD", condition: "Worn, full set", proof_detail: "the engraving on the caseback" },
  { title: "Apple iPad Pro 11-inch (M4)", category: "tablet", brand: "Apple", model: "iPad Pro 11 M4", price: 700, currency: "USD", condition: "Used, no scratches", proof_detail: "the model number printed on the back" },
];

// Same kind of item, different (usually pricier) model: the classic "wrong model" scam.
const OTHER_MODELS: Record<string, Listing> = {
  "computer mouse": { title: "Logitech G Pro X Superlight 2 Wireless Gaming Mouse", category: "computer mouse", brand: "Logitech", model: "G Pro X Superlight 2", price: 110, currency: "USD", condition: "Used, works perfectly", proof_detail: "the model label on the underside of the mouse" },
  headphones: { title: "Apple AirPods Max", category: "headphones", brand: "Apple", model: "AirPods Max", price: 350, currency: "USD", condition: "Used, with case", proof_detail: "the serial number inside the ear cushion" },
  "graphics card": { title: "NVIDIA GeForce RTX 4090 Founders Edition", category: "graphics card", brand: "NVIDIA", model: "RTX 4090 FE", price: 1500, currency: "USD", condition: "Used, never mined", proof_detail: "the model sticker on the back of the card" },
};

const pick = <T,>(list: readonly T[]) => list[randomInt(list.length)];
const randomCode = () => Array.from({ length: 5 }, () => pick([...CODE_ALPHABET])).join("");
const otherGesture = (...not: Gesture[]) => pick(CHALLENGE_GESTURES.filter((g) => !not.includes(g)));

async function exists(p: string) {
  return access(p).then(() => true, () => false);
}

async function main() {
  const names = (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory() && !d.name.includes("__")).map((d) => d.name);
  let written = 0;
  for (const name of names) {
    const base = path.join(dir, name);
    const meta = JSON.parse(await readFile(path.join(base, "meta.json"), "utf8"));
    if (meta.label !== "genuine") continue;
    const category = String(meta.listing.category).toLowerCase();

    const variants: { type: string; patch: Record<string, unknown> }[] = [];
    let code = randomCode();
    while (code === meta.code) code = randomCode();
    const gA = pick(CHALLENGE_GESTURES);
    variants.push({ type: "replay", patch: { code, gestureA: gA, gestureB: otherGesture(gA) } });
    const others = OTHER_ITEMS.filter((l) => l.category.toLowerCase() !== category);
    const first = pick(others);
    variants.push({ type: "other_item", patch: { listing: first } });
    variants.push({ type: "other_item", patch: { listing: pick(others.filter((l) => l !== first)) } });
    if (OTHER_MODELS[category]) variants.push({ type: "other_model", patch: { listing: OTHER_MODELS[category] } });
    variants.push({ type: "wrong_gesture", patch: { gestureA: otherGesture(meta.gestureA, meta.gestureB) } });
    variants.push({ type: "wrong_gesture", patch: { gestureB: otherGesture(meta.gestureA, meta.gestureB) } });

    const counts: Record<string, number> = {};
    for (const v of variants) {
      counts[v.type] = (counts[v.type] ?? 0) + 1;
      const out = `${base}__${v.type}-${counts[v.type]}`;
      if (await exists(out)) continue;
      await mkdir(out, { recursive: true });
      for (const f of [...meta.files.m1, ...meta.files.m2]) await copyFile(path.join(base, f), path.join(out, f));
      const derived = { ...meta, ...v.patch, label: "attack", attack: v.type, derivedFrom: name, notes: `Derived from genuine case ${name}: same frames, ${v.type}.` };
      delete derived.live;
      await writeFile(path.join(out, "meta.json"), JSON.stringify(derived, null, 2));
      written++;
      console.log(out);
    }
  }
  console.log(`${written} derived cases written`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
