import QRCode from "qrcode";
import { sellerId, store } from "@/lib/challenge";
import { createHandoff, HANDOFF_TTL_MS } from "@/lib/handoff";
import { baseUrl } from "@/lib/paypal";
import { getSeller } from "@/lib/session";

// The computer asks for a QR code that opens the same listing on the seller's phone.
export async function POST(request: Request) {
  const seller = await getSeller();
  if (!seller) return Response.json({ error: "Log in with PayPal first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const draft = typeof body?.draftId === "string" ? store.drafts.get(body.draftId) : undefined;
  if (!draft || draft.sellerId !== sellerId(seller)) {
    return Response.json({ error: "Paste your listing again" }, { status: 404 });
  }

  const url = `${baseUrl()}/go/${createHandoff(seller, draft.id)}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return Response.json({ url, svg, expiresInMs: HANDOFF_TTL_MS });
}
