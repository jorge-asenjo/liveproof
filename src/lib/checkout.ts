// Starting a payment for a deal (server-only). Shared by the PayPal button (JS SDK) and
// the no-JavaScript redirect. The payee always comes from the deal, never from the request.
import { deals, type Deal } from "./deals";
import { baseUrl, createOrder, getOrder, PayPalError, type Payee } from "./paypal";
import { settle, type SettleResult } from "./settle";

export type Start =
  | { kind: "approve"; orderId: string; approveUrl: string }
  | { kind: "settled"; result: SettleResult }
  | { kind: "error" };

// For the deal page's ?payment= notice.
export function paymentParam(result: SettleResult) {
  return { paid: "done", pending: "pending", not_approved: "cancelled", rejected: "error", failed: "error" }[result];
}

export async function startPayment(deal: Deal, opts: { reuse: boolean; forSdk: boolean }): Promise<Start> {
  if (deal.pendingOrderId) {
    try {
      const existing = await getOrder(deal.pendingOrderId);
      // The buyer already approved (or paid) an order for this deal: finish that one.
      if (existing.status === "APPROVED" || existing.status === "COMPLETED") {
        return { kind: "settled", result: await settle(deal, existing.orderId) };
      }
      if (opts.reuse && (existing.status === "CREATED" || existing.status === "PAYER_ACTION_REQUIRED") && existing.approveUrl) {
        return { kind: "approve", orderId: existing.orderId, approveUrl: existing.approveUrl };
      }
    } catch (err) {
      console.error("pending order check failed", { deal: deal.id, detail: String(err) });
    }
  }

  const dealUrl = `${baseUrl()}/deal/${encodeURIComponent(deal.id)}`;
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
        returnUrl: `${baseUrl()}/api/deal/${encodeURIComponent(deal.id)}/return`,
        cancelUrl: `${dealUrl}?payment=cancelled`,
        forSdk: opts.forSdk,
        // PayPal shows this item to the buyer: its link and image are the live proof
        // (only on https: PayPal does not take localhost links).
        item: baseUrl().startsWith("https://")
          ? {
              name: deal.item.title,
              url: dealUrl,
              imageUrl: `${baseUrl()}/api/deal/${encodeURIComponent(deal.id)}/proof.jpg`,
              description: `Proved live on camera on ${new Date(deal.proof.provedAt).toUTCString().slice(5, 16)} (LiveProof)`,
            }
          : undefined,
      });
      await deals.setPendingOrder(deal.id, order.id);
      console.log("order created", { deal: deal.id, order: order.id, payee: Object.keys(payee)[0], sdk: opts.forSdk });
      return { kind: "approve", orderId: order.id, approveUrl: order.approveUrl };
    } catch (err) {
      const detail = err instanceof PayPalError ? JSON.stringify(err.body) : String(err);
      console.error("create order failed", { deal: deal.id, payee: Object.keys(payee)[0], detail });
      // A payee PayPal rejects (4xx) is retried with the next identifier of the same account.
      const retry = err instanceof PayPalError && err.status >= 400 && err.status < 500 && i < payees.length - 1;
      if (!retry) break;
    }
  }
  return { kind: "error" };
}
