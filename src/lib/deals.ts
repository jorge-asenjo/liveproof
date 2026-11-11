// Deals: what the buyer sees and pays. A deal is created from a live proof that passed
// and keeps the verified PayPal account that did it; the order's payee comes from here.
// Stored in Postgres (Neon) when DATABASE_URL is set, so links survive Render's restarts;
// otherwise in memory (local development).
import { neon } from "@neondatabase/serverless";
import type { Gesture } from "./gestures";
import type { Check, Observation } from "./verify";

export type DealSeller = {
  payerId: string | null;
  userId: string | null;
  name: string;
  email: string | null;
  verified: boolean;
};

export type Payment = {
  orderId: string;
  captureId: string | null;
  status: string;
  value: string;
  currency: string;
  paidAt: number;
  payee: { merchantId: string | null; email: string | null };
  payeeMatches: boolean;
  payer: { name: string | null; email: string | null };
  sellerProtection: string | null;
};

export type Deal = {
  id: string;
  createdAt: number;
  seller: DealSeller;
  item: { title: string; category: string; condition: string | null };
  amount: { value: string; currency: string };
  proof: {
    provedAt: number;
    code: string;
    gestureA: Gesture;
    gestureB: Gesture;
    gestureBDelayMs: number;
    checks: Check[];
    seen: string;
    model: string;
    verifyMs: number;
    observation?: Observation; // Claude's report; missing on deals made before 12-nov
  };
  frameCount: number;
  payment: Payment | null;
};

interface DealStore {
  create(deal: Deal, frames: string[]): Promise<void>;
  get(id: string): Promise<Deal | null>;
  frame(id: string, index: number): Promise<string | null>;
  setPayment(id: string, payment: Payment): Promise<void>;
}

function memoryStore(): DealStore {
  const g = globalThis as typeof globalThis & { __liveproofDeals?: Map<string, { deal: Deal; frames: string[] }> };
  const map = (g.__liveproofDeals ??= new Map());
  return {
    async create(deal, frames) {
      map.set(deal.id, { deal, frames });
    },
    async get(id) {
      return map.get(id)?.deal ?? null;
    },
    async frame(id, index) {
      return map.get(id)?.frames[index] ?? null;
    },
    async setPayment(id, payment) {
      const row = map.get(id);
      if (row) row.deal = { ...row.deal, payment };
    },
  };
}

function postgresStore(url: string): DealStore {
  const sql = neon(url);
  let ready: Promise<unknown> | null = null;
  const init = () =>
    (ready ??= sql`create table if not exists deals (
      id text primary key,
      created_at timestamptz not null default now(),
      deal jsonb not null,
      frames jsonb not null
    )`.catch((err) => {
      ready = null;
      throw err;
    }));

  return {
    async create(deal, frames) {
      await init();
      await sql`insert into deals (id, deal, frames) values (${deal.id}, ${JSON.stringify(deal)}::jsonb, ${JSON.stringify(frames)}::jsonb)`;
    },
    async get(id) {
      await init();
      const rows = await sql`select deal from deals where id = ${id}`;
      return (rows[0]?.deal as Deal | undefined) ?? null;
    },
    async frame(id, index) {
      await init();
      const rows = await sql`select frames->>${index}::int as frame from deals where id = ${id}`;
      return (rows[0]?.frame as string | null | undefined) ?? null;
    },
    async setPayment(id, payment) {
      await init();
      await sql`update deals set deal = jsonb_set(deal, '{payment}', ${JSON.stringify(payment)}::jsonb) where id = ${id}`;
    },
  };
}

const g = globalThis as typeof globalThis & { __liveproofDealStore?: DealStore };
export const deals: DealStore = (g.__liveproofDealStore ??= process.env.DATABASE_URL
  ? postgresStore(process.env.DATABASE_URL)
  : memoryStore());

// The money can only go to the account that did the live proof. merchant_id is the
// stable PayPal account id (payer_id from Log in with PayPal); the email is a fallback.
export function payeeMatches(seller: DealSeller, payee: { merchantId: string | null; email: string | null }) {
  if (seller.payerId && payee.merchantId) return seller.payerId === payee.merchantId;
  return !!seller.email && !!payee.email && seller.email.toLowerCase() === payee.email.toLowerCase();
}

export const DEAL_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;
export const MAX_DEAL_AMOUNT = 10_000;

export function parseAmount(raw: unknown): string | null {
  const text = typeof raw === "number" ? raw.toFixed(2) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(text)) return null;
  const value = Number(text);
  if (!(value > 0) || value > MAX_DEAL_AMOUNT) return null;
  return value.toFixed(2);
}
