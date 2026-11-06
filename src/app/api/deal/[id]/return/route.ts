import type { NextRequest } from "next/server";
import { deals, payeeMatches, type Payment } from "@/lib/deals";
import { baseUrl, captureOrder, PayPalError } from "@/lib/paypal";

// PayPal sends the buyer back here after they approve. The server captures the payment
// and checks, from PayPal's own answer, that it went to the account that did the proof.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/deal/[id]/return">) {
  const { id } = await ctx.params;
  const orderId = request.nextUrl.searchParams.get("token");
  const dealUrl = `${baseUrl()}/deal/${encodeURIComponent(id)}`;
  const deal = await deals.get(id);
  if (!deal) return Response.redirect(`${baseUrl()}/deal/not-found`, 303);
  if (deal.payment) return Response.redirect(dealUrl, 303);
  if (!orderId) return Response.redirect(`${dealUrl}?payment=error`, 303);

  try {
    const order = await captureOrder(orderId);
    // The order must be one LiveProof created for this deal.
    if (order.customId !== deal.id) {
      console.error("order does not belong to this deal", { deal: deal.id, order: orderId, customId: order.customId });
      return Response.redirect(`${dealUrl}?payment=error`, 303);
    }
    if (order.status !== "COMPLETED" || !order.capture) {
      console.error("order not completed", { deal: deal.id, order: orderId, status: order.status });
      return Response.redirect(`${dealUrl}?payment=error`, 303);
    }
    const payment: Payment = {
      orderId: order.orderId,
      captureId: order.capture.id,
      status: order.capture.status,
      value: order.capture.value,
      currency: order.capture.currency,
      paidAt: Date.now(),
      payee: order.payee,
      payeeMatches: payeeMatches(deal.seller, order.payee),
      payer: order.payer,
      sellerProtection: order.capture.sellerProtection,
    };
    await deals.setPayment(deal.id, payment);
    console.log("payment captured", { deal: deal.id, order: orderId, payeeMatches: payment.payeeMatches });
    return Response.redirect(`${dealUrl}?payment=done`, 303);
  } catch (err) {
    const detail = err instanceof PayPalError ? JSON.stringify(err.body) : String(err);
    console.error("capture failed", { deal: deal.id, order: orderId, detail });
    return Response.redirect(`${dealUrl}?payment=error`, 303);
  }
}
