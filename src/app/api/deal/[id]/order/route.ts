import type { NextRequest } from "next/server";
import { paymentParam, startPayment } from "@/lib/checkout";
import { deals } from "@/lib/deals";

// The PayPal button (JS SDK) asks for an order to approve in its popup. The server creates it
// with the payee fixed to the account that did the live proof; the browser only gets its id.
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/deal/[id]/order">) {
  const { id } = await ctx.params;
  const deal = await deals.get(id);
  if (!deal) return Response.json({ error: "This deal does not exist" }, { status: 404 });
  if (deal.payment) return Response.json({ settled: "done" });

  const start = await startPayment(deal, { reuse: false, forSdk: true });
  if (start.kind === "approve") return Response.json({ id: start.orderId });
  if (start.kind === "settled") return Response.json({ settled: paymentParam(start.result) });
  return Response.json({ error: "PayPal could not create the order. Try again." }, { status: 502 });
}
