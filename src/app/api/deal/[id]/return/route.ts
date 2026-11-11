import type { NextRequest } from "next/server";
import { deals } from "@/lib/deals";
import { baseUrl } from "@/lib/paypal";
import { settle } from "@/lib/settle";

// PayPal sends the buyer back here after they approve. The server checks the order (this
// deal, this amount, the account that did the proof) before capturing it; see lib/settle.ts.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/deal/[id]/return">) {
  const { id } = await ctx.params;
  const orderId = request.nextUrl.searchParams.get("token");
  const dealUrl = `${baseUrl()}/deal/${encodeURIComponent(id)}`;
  const deal = await deals.get(id);
  if (!deal) return Response.redirect(`${baseUrl()}/deal/not-found`, 303);
  if (deal.payment) return Response.redirect(dealUrl, 303);
  if (!orderId) return Response.redirect(`${dealUrl}?payment=error`, 303);

  try {
    const result = await settle(deal, orderId);
    console.log("settle", { deal: deal.id, order: orderId, result });
    const param = { paid: "done", pending: "pending", not_approved: "cancelled", rejected: "error", failed: "error" }[result];
    return Response.redirect(`${dealUrl}?payment=${param}`, 303);
  } catch (err) {
    // Something failed after PayPal may have taken the money (e.g. the database): never tell
    // the buyer "nothing was charged" here. The deal page reconciles with PayPal on load.
    console.error("settle error", { deal: deal.id, order: orderId, detail: String(err) });
    return Response.redirect(`${dealUrl}?payment=processing`, 303);
  }
}
