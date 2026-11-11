import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { evalCaptureEnabled } from "@/lib/attempts";
import { sellerId, store } from "@/lib/challenge";
import { getSeller } from "@/lib/session";
import SellerFlow from "./seller-flow";

export const metadata: Metadata = { title: "Sell with live proof · LiveProof" };

export default function SellPage({ searchParams }: PageProps<"/sell">) {
  return (
    <main className="min-h-screen bg-desk text-graphite">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            LiveProof
          </Link>
          <span className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-neutral-600 ring-1 ring-line">PayPal sandbox</span>
        </header>
        <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
          <SellerGate searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

const LOGIN_NOTICES: Record<string, string> = {
  expired: "Your PayPal login took too long or was interrupted, so we could not finish it. Log in again.",
  failed: "PayPal did not confirm your login. Nothing was saved. Log in again.",
  qr: "That QR code has expired or was already used. Show a new one on your computer, or log in with PayPal here.",
};

async function SellerGate({ searchParams }: Pick<PageProps<"/sell">, "searchParams">) {
  await connection(); // per-request: the session check uses the current time
  const seller = await getSeller();
  const { login, draft: draftParam } = await searchParams;
  if (!seller) {
    const notice = typeof login === "string" ? LOGIN_NOTICES[login] : undefined;
    return (
      <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        {notice && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</p>}
        <h1 className="text-2xl font-semibold">First, log in with PayPal</h1>
        <p className="text-neutral-600">
          Your live proof is tied to the PayPal account you log in with. Buyers can only pay that account.
        </p>
        <a
          href="/api/auth/paypal/start"
          className="w-fit rounded-full bg-[#0070e0] px-6 py-3 font-medium text-white hover:bg-[#005ea6]"
        >
          Log in with PayPal
        </a>
      </section>
    );
  }
  // Arriving from the "continue on your phone" QR code: pick up the listing read on the computer.
  const draft = typeof draftParam === "string" ? store.drafts.get(draftParam) : undefined;
  const initialDraft = draft && draft.sellerId === sellerId(seller) ? { id: draft.id, listing: draft.listing } : null;
  return (
    <SellerFlow
      initialDraft={initialDraft}
      evalCapture={evalCaptureEnabled(seller)}
      seller={{
        name: seller.name ?? "PayPal user",
        email: seller.email ?? "",
        verified: seller.verified_account === true || seller.verified_account === "true",
      }}
    />
  );
}
