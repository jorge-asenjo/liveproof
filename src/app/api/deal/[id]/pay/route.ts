import type { NextRequest } from "next/server";
import { paymentParam, startPayment } from "@/lib/checkout";
import { deals } from "@/lib/deals";
import { baseUrl } from "@/lib/paypal";

// Pay without JavaScript: a full-page redirect to PayPal. The server creates the order with
// the payee fixed to the account that did the live proof (lib/checkout.ts); nothing in the
// request can change who gets paid.
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/deal/[id]/pay">) {
  const { id } = await ctx.params;
  const deal = await deals.get(id);
  const dealUrl = `${baseUrl()}/deal/${encodeURIComponent(id)}`;
  if (!deal) return Response.redirect(`${baseUrl()}/deal/not-found`, 303);
  if (deal.payment) return Response.redirect(dealUrl, 303);

  // A new order each time (with its return URL); one approved earlier is settled instead, and
  // invoice_id stops a second payment for the same deal.
  const start = await startPayment(deal, { reuse: false, forSdk: false });
  if (start.kind === "approve") return Response.redirect(start.approveUrl, 303);
  if (start.kind === "settled") return Response.redirect(`${dealUrl}?payment=${paymentParam(start.result)}`, 303);
  return Response.redirect(`${dealUrl}?payment=error`, 303);
}
