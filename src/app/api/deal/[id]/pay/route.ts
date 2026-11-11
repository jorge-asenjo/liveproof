import type { NextRequest } from "next/server";
import { deals } from "@/lib/deals";
import { baseUrl, createOrder, getOrder, PayPalError, type Payee } from "@/lib/paypal";
import { settle } from "@/lib/settle";

// The buyer presses "Pay with PayPal". The server creates the order with the payee
// fixed to the account that did the live proof, then sends the buyer to PayPal.
// Nothing in the request can change who gets paid. If the buyer already has an order
// for this deal, it is reused (or settled), so pressing Pay twice never makes two payments.
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/deal/[id]/pay">) {
  const { id } = await ctx.params;
  const deal = await deals.get(id);
  const dealUrl = `${baseUrl()}/deal/${encodeURIComponent(id)}`;
  if (!deal) return Response.redirect(`${baseUrl()}/deal/not-found`, 303);
  if (deal.payment) return Response.redirect(dealUrl, 303);

  if (deal.pendingOrderId) {
    try {
      const existing = await getOrder(deal.pendingOrderId);
      if (existing.status === "APPROVED" || existing.status === "COMPLETED") {
        const result = await settle(deal, existing.orderId);
        return Response.redirect(`${dealUrl}?payment=${result === "paid" ? "done" : result === "pending" ? "pending" : "error"}`, 303);
      }
      if ((existing.status === "CREATED" || existing.status === "PAYER_ACTION_REQUIRED") && existing.approveUrl) {
        return Response.redirect(existing.approveUrl, 303);
      }
    } catch (err) {
      console.error("pending order check failed", { deal: deal.id, detail: String(err) });
    }
  }

  const payees: Payee[] = [];
  if (deal.seller.payerId) payees.push({ merchant_id: deal.seller.payerId });
  if (deal.seller.email) payees.push({ email_address: deal.seller.email });

  for (const [i, payee] of payees.entries()) {
    try {
      const order = await createOrder({
        dealId: deal.id,
        description: `${deal.item.title} (LiveProof ${deal.id})`,
        amount: deal.amount,
        payee,
        returnUrl: `${baseUrl()}/api/deal/${encodeURIComponent(id)}/return`,
        cancelUrl: `${dealUrl}?payment=cancelled`,
      });
      await deals.setPendingOrder(deal.id, order.id);
      console.log("order created", { deal: deal.id, order: order.id, payee: Object.keys(payee)[0] });
      return Response.redirect(order.approveUrl, 303);
    } catch (err) {
      const detail = err instanceof PayPalError ? JSON.stringify(err.body) : String(err);
      console.error("create order failed", { deal: deal.id, payee: Object.keys(payee)[0], detail });
      // A payee PayPal rejects (4xx) is retried with the next identifier of the same account.
      const retry = err instanceof PayPalError && err.status >= 400 && err.status < 500 && i < payees.length - 1;
      if (!retry) break;
    }
  }
  return Response.redirect(`${dealUrl}?payment=error`, 303);
}
