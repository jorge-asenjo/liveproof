import type { NextRequest } from "next/server";
import { paymentParam } from "@/lib/checkout";
import { deals } from "@/lib/deals";
import { settle } from "@/lib/settle";

// The buyer approved in the PayPal popup. The server checks the order (this deal, this
// amount, the account that did the proof) and only then captures it; see lib/settle.ts.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/deal/[id]/capture">) {
  const { id } = await ctx.params;
  const deal = await deals.get(id);
  if (!deal) return Response.json({ error: "This deal does not exist" }, { status: 404 });
  if (deal.payment) return Response.json({ param: "done" });

  const body = await request.json().catch(() => null);
  const orderId = typeof body?.orderID === "string" && /^[A-Z0-9]{8,40}$/.test(body.orderID) ? body.orderID : null;
  if (!orderId) return Response.json({ error: "Missing PayPal order" }, { status: 400 });
  try {
    const result = await settle(deal, orderId);
    console.log("settle", { deal: deal.id, order: orderId, result, sdk: true });
    return Response.json({ param: paymentParam(result) });
  } catch (err) {
    // PayPal may have taken the money: the deal page reconciles on load; never say "not charged".
    console.error("settle error", { deal: deal.id, order: orderId, detail: String(err) });
    return Response.json({ param: "processing" }, { status: 502 });
  }
}
