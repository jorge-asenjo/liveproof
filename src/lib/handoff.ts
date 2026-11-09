// "Continue on your phone" (server-only). The computer asks for a one-time link; the phone
// opens it and gets the same seller session and listing draft, so the seller does not log
// in to PayPal again on the phone. In memory, like drafts: one instance on Render free.
import { newId } from "./challenge";
import type { Seller } from "./session";

export const HANDOFF_TTL_MS = 10 * 60_000;

type Handoff = { seller: Seller; draftId: string; expiresAt: number };

const g = globalThis as typeof globalThis & { __liveproofHandoffs?: Map<string, Handoff> };
const handoffs: Map<string, Handoff> = (g.__liveproofHandoffs ??= new Map());

export function createHandoff(seller: Seller, draftId: string) {
  const now = Date.now();
  for (const [id, h] of handoffs) if (h.expiresAt < now) handoffs.delete(id);
  const id = newId(12);
  handoffs.set(id, { seller, draftId, expiresAt: now + HANDOFF_TTL_MS });
  return id;
}

// One use only: a second scan of the same code gets nothing.
export function takeHandoff(id: string): Handoff | null {
  const h = handoffs.get(id);
  handoffs.delete(id);
  if (!h || h.expiresAt < Date.now()) return null;
  return h;
}
