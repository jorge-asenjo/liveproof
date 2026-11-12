import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { deals, type Deal } from "@/lib/deals";
import { CARRIERS } from "@/lib/paypal";
import { getSeller } from "@/lib/session";
import { reconcile } from "@/lib/settle";
import { GESTURE_INFO } from "@/lib/gestures";
import ClaudeReport from "../../claude-report";

export const metadata: Metadata = {
  title: "Live proof deal · LiveProof",
  robots: { index: false, follow: false },
};

export default function DealPage({ params, searchParams }: PageProps<"/deal/[id]">) {
  return (
    <main className="min-h-screen bg-desk text-graphite">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            LiveProof
          </Link>
          <span className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-neutral-600 ring-1 ring-line">PayPal sandbox</span>
        </header>
        <Suspense fallback={<p className="text-neutral-500">Loading the deal…</p>}>
          <DealView params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function DealView({ params, searchParams }: Pick<PageProps<"/deal/[id]">, "params" | "searchParams">) {
  await connection(); // per-request: payment status and "proved N minutes ago"
  const { id } = await params;
  const { payment: paymentParam, tracking: trackingParam } = await searchParams;
  const stored = await deals.get(id);
  // A buyer went to PayPal but no payment is recorded: ask PayPal whether it was captured.
  const deal = stored && !stored.payment && stored.pendingOrderId ? await reconcile(stored) : stored;
  if (!deal) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h1 className="text-2xl font-semibold">This deal does not exist</h1>
        <p className="mt-2 text-neutral-600">Check the link the seller sent you. Do not pay a seller who cannot show a live proof.</p>
      </section>
    );
  }
  const now = requestTime();
  const viewer = await getSeller();
  const viewerIsSeller = !!viewer && !!deal.seller.payerId && viewer.payer_id === deal.seller.payerId;
  return (
    <>
      {typeof trackingParam === "string" && TRACKING_NOTICES[trackingParam] && (
        <p className={`rounded-xl px-4 py-3 text-sm ${trackingParam === "added" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
          {TRACKING_NOTICES[trackingParam]}
        </p>
      )}
      {paymentParam === "cancelled" && !deal.payment && (
        <p className="rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">Payment cancelled. Nothing was charged.</p>
      )}
      {paymentParam === "processing" && !deal.payment && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          PayPal is still processing this payment. Do not pay again: refresh this page in a minute.
        </p>
      )}
      {paymentParam === "error" && !deal.payment && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">PayPal could not complete the payment. Nothing was charged. Try again.</p>
      )}

      <ItemCard deal={deal} />
      {/* Before paying, the buyer sees the proof first; once paid, the payment comes first. */}
      {deal.payment ? (
        <>
          <PaidCard deal={deal} />
          <ShipmentCard deal={deal} viewerIsSeller={viewerIsSeller} />
          <ProofCard deal={deal} now={now} />
        </>
      ) : (
        <>
          <ProofCard deal={deal} now={now} />
          <PayCard deal={deal} />
        </>
      )}
    </>
  );
}

const TRACKING_NOTICES: Record<string, string> = {
  added: "Tracking added to the PayPal transaction. PayPal emails it to the buyer.",
  invalid: "Check the tracking number and the carrier, then try again.",
  error: "PayPal did not accept the tracking. Check the number and try again.",
  "not-seller": "Only the PayPal account that did the live proof can add tracking. Log in with PayPal as the seller.",
  "not-paid": "Tracking can be added once the payment is completed.",
};

function ShipmentCard({ deal, viewerIsSeller }: { deal: Deal; viewerIsSeller: boolean }) {
  const s = deal.shipment;
  if (s) {
    return (
      <section className="flex flex-col gap-2 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="text-lg font-semibold">Shipped</h2>
        <p>
          {s.carrier}, tracking <span className="font-medium tabular-nums">{s.trackingNumber}</span>
        </p>
        <p className="text-sm text-neutral-600">
          Added to the PayPal transaction on {new Date(s.addedAt).toUTCString()}, with the item linked to this live proof. PayPal emails the
          tracking to the buyer.
        </p>
      </section>
    );
  }
  if (!viewerIsSeller || deal.payment?.status !== "COMPLETED") return null;
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
      <div>
        <h2 className="text-lg font-semibold">Add the shipment tracking</h2>
        <p className="text-sm text-neutral-600">
          LiveProof adds it to the PayPal transaction, with the item linked to your live proof. Shipping to the address on the PayPal
          transaction, with tracking, is what PayPal Seller Protection asks for.
        </p>
      </div>
      <form action={`/api/deal/${deal.id}/tracking`} method="post" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-600">Carrier</span>
          <select name="carrier" defaultValue="USPS" className="rounded-lg border border-neutral-300 bg-white px-3 py-2">
            {CARRIERS.map((c) => (
              <option key={c} value={c}>
                {c === "OTHER" ? "Other" : c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-600">Other carrier name</span>
          <input name="carrier_other" placeholder="Only for Other" className="rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-neutral-600">Tracking number</span>
          <input name="tracking_number" required minLength={6} maxLength={40} className="rounded-lg border border-neutral-300 px-3 py-2" />
        </label>
        <button type="submit" className="rounded-full bg-ink px-6 py-2.5 font-medium text-white">
          Add tracking to PayPal
        </button>
      </form>
    </section>
  );
}

// Server component rendered once per request (after connection()), so reading the clock is fine.
function requestTime() {
  return Date.now();
}

function money(value: string, currency: string) {
  const n = Number(value);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${value} ${currency}`;
  }
}

function ago(ms: number) {
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

function ItemCard({ deal }: { deal: Deal }) {
  return (
    <section className="flex flex-col gap-1 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
      <p className="text-sm uppercase tracking-widest text-neutral-500">{deal.item.category}</p>
      <h1 className="text-2xl font-semibold">{deal.item.title}</h1>
      <p className="text-3xl font-semibold">{money(deal.amount.value, deal.amount.currency)}</p>
      {deal.item.condition && <p className="text-neutral-600">{deal.item.condition}</p>}
    </section>
  );
}

function SellerAccount({ deal }: { deal: Deal }) {
  const s = deal.seller;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-semibold text-white">
        {s.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{s.name}</p>
        {s.email && <p className="truncate text-sm text-neutral-600">{s.email}</p>}
        {s.payerId && <p className="truncate font-mono text-xs text-neutral-400">PayPal ID {s.payerId}</p>}
      </div>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${s.verified ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}
      >
        {s.verified ? "Verified PayPal account" : "Not verified by PayPal"}
      </span>
    </div>
  );
}

function PayCard({ deal }: { deal: Deal }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
      <div>
        <h2 className="text-lg font-semibold">This link only pays the account that did the live proof</h2>
        <p className="mt-1 text-sm text-neutral-600">
          LiveProof fixes the payee when it creates the PayPal order, so the money cannot go anywhere else, even if someone copies
          this link.
        </p>
      </div>
      <SellerAccount deal={deal} />
      <form action={`/api/deal/${deal.id}/pay`} method="post">
        <button
          type="submit"
          className="w-full rounded-full bg-[#ffc439] px-6 py-4 text-lg font-semibold text-[#003087] hover:bg-[#f2ba36]"
        >
          Pay {money(deal.amount.value, deal.amount.currency)} with PayPal
        </button>
      </form>
      <p className="text-xs text-neutral-500">
        PayPal Goods and Services, with buyer protection. If the seller asks you to pay another account, use Friends and Family or pay
        an invoice they send you, stop: that is not the account that proved it has the item.
      </p>
    </section>
  );
}

function PaidCard({ deal }: { deal: Deal }) {
  const p = deal.payment!;
  const provedBy = deal.seller.payerId ?? deal.seller.email ?? "unknown";
  const paidTo = p.payee.merchantId ?? p.payee.email ?? "unknown";
  const completed = p.status === "COMPLETED";
  const tone = !p.payeeMatches ? "ring-red-500" : completed ? "ring-emerald-500" : "ring-amber-400";
  return (
    <section className={`flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-2 ${tone}`}>
      <div>
        <h2 className={`text-2xl font-semibold ${!p.payeeMatches ? "text-red-700" : completed ? "text-emerald-700" : "text-amber-700"}`}>
          {completed ? `Paid ${money(p.value, p.currency)}` : `Payment of ${money(p.value, p.currency)} pending at PayPal`}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          {p.payer.name ? `By ${p.payer.name}, ` : ""}
          {new Date(p.paidAt).toUTCString()}
        </p>
      </div>
      <SellerAccount deal={deal} />
      {/* The chain: the account that proved it, and the account PayPal says it paid. */}
      <div className="flex flex-col gap-2 rounded-xl bg-desk p-4">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_auto] sm:items-baseline">
          <p className="text-sm text-neutral-600">Did the live proof (from Log in with PayPal)</p>
          <p className="font-semibold tabular-nums">{provedBy}</p>
        </div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_auto] sm:items-baseline">
          <p className="text-sm text-neutral-600">Was paid (from PayPal&apos;s capture response)</p>
          <p className="font-semibold tabular-nums">{paidTo}</p>
        </div>
        <p className={`text-sm font-semibold ${p.payeeMatches ? "text-ok" : "text-red-700"}`}>
          {p.payeeMatches
            ? "✓ Same PayPal account: the money went to the account that did the live proof"
            : "✗ Warning: PayPal reports a different payee than the account that did the live proof"}
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        <li className="flex gap-2">
          <span className={completed ? "text-emerald-600" : "text-amber-600"}>{completed ? "✓" : "!"}</span>
          <span>
            Capture {p.status.toLowerCase()}
            <span className="text-neutral-500 tabular-nums"> · {p.captureId}</span>
          </span>
        </li>
        {p.sellerProtection && (
          <li className="flex gap-2">
            <span className="text-neutral-400">·</span>
            <span className="text-neutral-600">Seller protection: {p.sellerProtection.toLowerCase().replace(/_/g, " ")}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

function ProofCard({ deal, now }: { deal: Deal; now: number }) {
  const pr = deal.proof;
  const a = GESTURE_INFO[pr.gestureA];
  const b = GESTURE_INFO[pr.gestureB];
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
      <div>
        <h2 className="text-lg font-semibold">Live proof of possession</h2>
        <p className="text-sm text-neutral-600">
          Proved live on camera {ago(now - pr.provedAt)} · {new Date(pr.provedAt).toUTCString()}
        </p>
        {pr.failedBefore !== undefined && (
          <p className={`mt-1 text-sm ${pr.failedBefore > 2 ? "font-medium text-amber-700" : "text-neutral-600"}`}>
            {pr.failedBefore === 0
              ? "Passed on the first try."
              : `${pr.failedBefore} failed ${pr.failedBefore === 1 ? "attempt" : "attempts"} by this account in the hour before this one.`}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <figure className="flex flex-col gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- frames are served by our own route */}
          <img src={`/api/deal/${deal.id}/frame/0`} alt="Moment 1 of the live proof" className="aspect-video w-full rounded-xl bg-neutral-200 object-cover" />
          <figcaption className="text-sm text-neutral-600">
            Code <span className="font-mono font-semibold">{pr.code}</span> written by hand, then {a.emoji} {a.label}
          </figcaption>
        </figure>
        <figure className="flex flex-col gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- frames are served by our own route */}
          <img src={`/api/deal/${deal.id}/frame/1`} alt="Moment 2 of the live proof" className="aspect-video w-full rounded-xl bg-neutral-200 object-cover" />
          <figcaption className="text-sm text-neutral-600">
            Surprise gesture {b.emoji} {b.label}, {(pr.gestureBDelayMs / 1000).toFixed(1)} s after it was revealed
          </figcaption>
        </figure>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {pr.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <span className={c.ok && !c.warn ? "text-emerald-600" : c.ok || !c.hard ? "text-amber-600" : "text-red-600"}>
              {c.ok && !c.warn ? "✓" : c.ok || !c.hard ? "!" : "✗"}
            </span>
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
      {pr.observation && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-ink">What Claude reported about these frames</summary>
          <div className="mt-3">
            <ClaudeReport observation={pr.observation} model={pr.model} />
          </div>
        </details>
      )}
      <p className="text-xs text-neutral-500">
        The code and the surprise gesture were random and shown only during the live proof, so an old photo or a video recorded in
        advance cannot pass. Seen on camera: {pr.seen.replace(/[.\s]+$/, "")}. Checked by {pr.model} in {(pr.verifyMs / 1000).toFixed(1)} s; fixed rules, not the
        model, decided the result.
      </p>
    </section>
  );
}
