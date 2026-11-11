"use client";

import { useEffect, useState } from "react";
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
}: {
  seller: { name: string; email: string; verified: boolean };
  initialDraft: Draft | null;
  evalCapture?: boolean;
}) {
  const device = useDevice();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(initialDraft);
  const [live, setLive] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [evalLabel, setEvalLabel] = useState("");

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
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0070e0] font-semibold text-white">
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
            className="w-full rounded-xl border border-neutral-300 p-3 font-mono text-sm outline-none focus:border-[#0070e0]"
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
                  ? "rounded-full px-6 py-3 font-medium text-[#0070e0] ring-1 ring-[#0070e0]"
                  : "rounded-full bg-[#0070e0] px-6 py-3 font-medium text-white"
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
          evalLabel={evalLabel}
          onEvalLabel={setEvalLabel}
        />
      )}

      {result && (
        <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
          <h1 className={`text-2xl font-semibold ${result.passed ? "text-emerald-700" : "text-red-700"}`}>
            {result.passed ? "Live proof passed" : "Live proof failed"}
          </h1>
          <ul className="flex flex-col gap-2">
            {result.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-3">
                <span className={c.ok ? "text-emerald-600" : c.hard ? "text-red-600" : "text-amber-600"}>
                  {c.ok ? "✓" : c.hard ? "✗" : "!"}
                </span>
                <span>
                  {c.label}
                  {c.detail && <span className="text-neutral-500"> · {c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-neutral-500">
            Seen on camera: {result.item.replace(/[.\s]+$/, "")}. Checked by {result.model} in {(result.verifyMs / 1000).toFixed(1)} s.
          </p>
          {result.tamperingSigns.length > 0 && (
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
  return (
    <div className="rounded-xl bg-neutral-100 p-4">
      <p className="font-medium">Your live proof takes about a minute</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-neutral-700">
        <li>Have a pen and a piece of paper ready.</li>
        <li>We show you a fresh code. Write it on the paper.</li>
        {computer ? (
          <>
            <li>Hold the paper and the item together in one hand, in front of the webcam.</li>
            <li>With your other hand, make the gesture we ask for. Then a surprise one, within 15 seconds.</li>
          </>
        ) : (
          <>
            <li>Put the paper next to the item on a table and point the back camera at both. No need to hold them.</li>
            <li>With your free hand, make the gesture we ask for. Then a surprise one, within 15 seconds.</li>
          </>
        )}
        <li>Also show: {proofDetail}.</li>
      </ol>
      <p className="mt-3 text-sm text-neutral-500">
        Item too big for the frame? Lean the paper against it, step back until both are in view, and write the code big.
      </p>
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
    <div className="flex flex-col gap-4 rounded-xl bg-[#0070e0]/5 p-4 ring-1 ring-[#0070e0]/30 sm:flex-row sm:items-center">
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
          <a href={url} target="_blank" rel="noreferrer" className="rounded-full px-5 py-2 text-sm font-medium text-[#0070e0] ring-1 ring-[#0070e0]">
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
          className="w-32 rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:border-[#0070e0]"
        />
        <span className="text-neutral-600">{currency}</span>
      </label>
      <button
        onClick={create}
        disabled={busy || !amount}
        className="w-fit rounded-full bg-[#0070e0] px-6 py-3 font-medium text-white disabled:opacity-40"
      >
        {busy ? "Creating…" : "Create buyer link"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-sm text-neutral-600">Payments through this link can only go to the PayPal account you logged in with.</p>
    </div>
  );
}
