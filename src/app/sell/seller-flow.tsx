"use client";

import { useEffect, useState } from "react";
import ClaudeReport from "../claude-report";
import LiveChallenge, { type VerifyResult } from "./live-challenge";
import { useDevice } from "./use-device";

type Listing = {
  title: string;
  category: string;
  brand: string | null;
  model: string | null;
  price: number | null;
  currency: string;
  condition: string | null;
  proof_detail: string;
};

const EXAMPLE = `[USA-CA] [H] RTX 3080 Founders Edition, local or shipped [W] PayPal G&S
Selling my 3080 FE, never mined, always in a case. Comes with the original box. $450 shipped CONUS. Timestamps in comments.`;

type Draft = { id: string; listing: Listing };

export default function SellerFlow({
  seller,
  initialDraft,
  evalCapture = false,
  presetEvalLabel,
}: {
  seller: { name: string; email: string; verified: boolean };
  initialDraft: Draft | null;
  evalCapture?: boolean;
  presetEvalLabel?: string;
}) {
  const device = useDevice();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(initialDraft);
  const [live, setLive] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [evalLabel, setEvalLabel] = useState(presetEvalLabel ?? "");

  async function readListing() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong");
      setDraft({ id: body.draftId, listing: body.listing });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink font-semibold text-white">
          {seller.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{seller.name}</p>
          <p className="truncate text-sm text-neutral-500">{seller.email}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${seller.verified ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}
        >
          {seller.verified ? "Verified PayPal account" : "PayPal account not verified"}
        </span>
      </section>

      {!draft && (
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
          <div>
            <h1 className="text-2xl font-semibold">Paste your listing</h1>
            <p className="text-neutral-600">From Reddit, Marketplace or a forum. We read the item and pick what to show on camera.</p>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={EXAMPLE}
            className="w-full rounded-xl border border-neutral-300 p-3 font-mono text-sm outline-none focus:border-ink"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={readListing}
              disabled={busy || text.trim().length < 10}
              className="rounded-full bg-neutral-900 px-6 py-3 font-medium text-white disabled:opacity-40"
            >
              {busy ? "Reading…" : "Read listing"}
            </button>
            <button onClick={() => setText(EXAMPLE)} className="text-sm text-neutral-500 underline">
              Use an example
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>
      )}

      {draft && !live && (
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm uppercase tracking-widest text-neutral-500">{draft.listing.category}</p>
          <h1 className="text-2xl font-semibold">{draft.listing.title}</h1>
          <p className="text-lg">
            {draft.listing.price != null ? `${draft.listing.price} ${draft.listing.currency}` : "No price stated"}
            {draft.listing.condition ? ` · ${draft.listing.condition}` : ""}
          </p>
          <Instructions computer={device === "computer"} proofDetail={draft.listing.proof_detail} />
          {device === "computer" && <PhoneHandoff draftId={draft.id} />}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setLive(true)}
              className={
                device === "computer"
                  ? "rounded-full px-6 py-3 font-medium text-ink ring-1 ring-ink"
                  : "rounded-full bg-ink px-6 py-3 font-medium text-white"
              }
            >
              {device === "computer" ? "Use this computer's camera" : "Start live proof"}
            </button>
            <button onClick={() => setDraft(null)} className="text-sm text-neutral-500 underline">
              Edit listing
            </button>
          </div>
        </section>
      )}

      {draft && live && !result && (
        <LiveChallenge
          draftId={draft.id}
          computer={device === "computer"}
          onResult={setResult}
          evalCapture={evalCapture}
          evalPickerHidden={!!presetEvalLabel}
          evalLabel={evalLabel}
          onEvalLabel={setEvalLabel}
        />
      )}

      {result && (
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
          <h1 className={`text-2xl font-semibold ${result.passed ? "text-emerald-700" : "text-red-700"}`}>
            {result.passed ? "Live proof passed" : "Live proof failed"}
          </h1>
          {result.observation && <ClaudeReport observation={result.observation} model={result.model} />}
          <p className="font-medium">The rules{result.observation ? ", checked against that report" : ""}</p>
          <ul className="flex flex-col gap-2">
            {result.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-3">
                <span className={c.ok && !c.warn ? "text-emerald-600" : c.ok || !c.hard ? "text-amber-600" : "text-red-600"}>
                  {c.ok && !c.warn ? "✓" : c.ok || !c.hard ? "!" : "✗"}
                </span>
                <span>
                  {c.label}
                  {c.detail && <span className="text-neutral-500"> · {c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-neutral-500">
            {result.observation ? "" : `Seen on camera: ${result.item.replace(/[.\s]+$/, "")}. `}Checked by {result.model} in{" "}
            {(result.verifyMs / 1000).toFixed(1)} s.
          </p>
          {!result.observation && result.tamperingSigns.length > 0 && (
            <p className="text-sm text-amber-700">Warnings: {result.tamperingSigns.join("; ")}</p>
          )}
          {result.passed && draft && <BuyerLink challengeId={result.challengeId} listing={draft.listing} />}
          <button
            onClick={() => {
              setResult(null);
              setLive(false);
            }}
            className={result.passed ? "w-fit text-sm text-neutral-500 underline" : "w-fit rounded-full bg-neutral-900 px-6 py-3 font-medium text-white"}
          >
            {result.passed ? "Do the live proof again" : "Try again"}
          </button>
        </section>
      )}
    </div>
  );
}

function Instructions({ computer, proofDetail }: { computer: boolean; proofDetail: string }) {
  const steps = [
    { title: "Write the fresh code", body: "A new code appears when you start. Write it big on a piece of paper." },
    {
      title: "Item and paper in view",
      body: computer
        ? "Hold the paper and the item up to the webcam, then show the gesture we ask for."
        : "Put the paper next to the item, point the back camera at both, then show the gesture.",
    },
    { title: "A surprise gesture", body: "Then a second gesture you could not know in advance, within 15 seconds." },
  ];
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-desk p-4">
      <p className="font-medium">Your live proof takes about a minute</p>
      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-2">
            <StepPicture step={i} />
            <p className="font-medium">
              {i + 1}. {s.title}
            </p>
            <p className="text-sm text-neutral-600">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-neutral-700">
        Have a pen and paper ready. Also show: <span className="font-medium">{proofDetail}</span>.
      </p>
      <p className="text-sm text-neutral-500">
        Item too big for the frame? Lean the paper against it, step back until both are in view, and write the code big.
      </p>
    </div>
  );
}

// Small looping pictures of each step (decorative; the text says the same).
function StepPicture({ step }: { step: number }) {
  return (
    <div aria-hidden="true" className="relative aspect-[4/3] overflow-hidden rounded-lg bg-graphite">
      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-rec" />
        LIVE
      </span>
      {step > 0 && (
        <div className="absolute bottom-[16%] left-[10%] h-[34%] w-[42%] rounded-md bg-[#3d454f] ring-2 ring-[#59636f]">
          <span className="absolute left-[18%] top-[22%] h-[56%] w-[30%] rounded-full ring-2 ring-[#6b7682]" />
          <span className="absolute right-[18%] top-[22%] h-[56%] w-[30%] rounded-full ring-2 ring-[#6b7682]" />
        </div>
      )}
      <div
        className={`absolute rounded-sm bg-paper px-2 py-1 shadow-md ${step === 0 ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-3deg] px-4 py-3" : "bottom-[14%] right-[10%] rotate-[4deg]"}`}
      >
        <span className={`font-hand font-bold text-ink ${step === 0 ? "loop-write block text-4xl" : "text-xl"}`}>HX7CT</span>
      </div>
      {step === 1 && <span className="loop-pop absolute right-[14%] top-[12%] text-4xl">👍</span>}
      {step === 2 && (
        <>
          <span className="loop-pop absolute right-[14%] top-[12%] text-4xl">✌️</span>
          <svg viewBox="0 0 40 40" className="absolute left-[44%] top-[14%] h-10 w-10 -rotate-90">
            <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
            <circle cx="20" cy="20" r="18" fill="none" stroke="#ffffff" strokeWidth="4" strokeDasharray="113" className="loop-ring" />
          </svg>
        </>
      )}
    </div>
  );
}

// On a computer the webcam faces the seller, so the item and the paper have to be held up.
// A phone's back camera can look down at the table instead: offer to move there, without
// logging in to PayPal again.
function PhoneHandoff({ draftId }: { draftId: string }) {
  const [round, setRound] = useState(0);
  const [qr, setQr] = useState<{ svg: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not make the QR code");
        if (!cancelled) {
          setQr({ svg: body.svg, url: body.url });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftId, round]);

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-ink-soft p-4 ring-1 ring-ink/30 sm:flex-row sm:items-center">
      <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg bg-white p-2 ring-1 ring-neutral-200">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL made by our own API
          <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`} alt="QR code to continue on your phone" className="h-full w-full" />
        ) : (
          <span className="text-sm text-neutral-400">{error ? "No QR code" : "Making the QR code…"}</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-medium">Easier on your phone</p>
        <p className="text-sm text-neutral-700">
          Scan this with your phone camera. The back camera can look down at the item on the table, so you only need one hand for
          the gestures. You stay logged in with the same PayPal account and the same listing.
        </p>
        <p className="text-sm text-neutral-500">
          The code works once, for 10 minutes.{" "}
          <button onClick={() => setRound((r) => r + 1)} className="underline">
            New code
          </button>
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function BuyerLink({ challengeId, listing }: { challengeId: string; listing: Listing }) {
  const [amount, setAmount] = useState(listing.price != null ? String(listing.price) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const currency = ["USD", "EUR", "GBP", "CAD", "AUD"].includes(listing.currency?.toUpperCase()) ? listing.currency.toUpperCase() : "USD";

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, amount }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong");
      setUrl(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (url) {
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
        <p className="font-medium">Send this link to your buyer</p>
        <p className="break-all rounded-lg bg-white px-3 py-2 font-mono text-sm ring-1 ring-emerald-200">{url}</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            }}
            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="rounded-full px-5 py-2 text-sm font-medium text-ink ring-1 ring-ink">
            Open buyer page
          </a>
        </div>
        <p className="text-sm text-neutral-600">The buyer sees your live proof and pays only your PayPal account.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-neutral-100 p-4">
      <p className="font-medium">Create the buyer link</p>
      <label className="flex items-center gap-2">
        <span className="text-neutral-600">Price</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(",", "."))}
          inputMode="decimal"
          placeholder="450"
          className="w-32 rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:border-ink"
        />
        <span className="text-neutral-600">{currency}</span>
      </label>
      <button
        onClick={create}
        disabled={busy || !amount}
        className="w-fit rounded-full bg-ink px-6 py-3 font-medium text-white disabled:opacity-40"
      >
        {busy ? "Creating…" : "Create buyer link"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-sm text-neutral-600">Payments through this link can only go to the PayPal account you logged in with.</p>
    </div>
  );
}
