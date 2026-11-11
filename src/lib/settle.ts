// Turns an approved PayPal order into a recorded payment, safely. Server-only.
// Order of operations: read the order from PayPal, check it is this deal's order, for this
// amount, paying the account that did the live proof; only then capture. A payment is
// recorded once (atomic), and an order that was already captured is read back, never
// captured twice. Without webhooks, the deal page calls reconcile() to catch up.
import { deals, payeeMatches, type Deal, type Payment } from "./deals";
import { captureOrder, getOrder, PayPalError, type CapturedOrder } from "./paypal";

export type SettleResult = "paid" | "pending" | "not_approved" | "rejected" | "failed";

function problems(deal: Deal, order: CapturedOrder): string[] {
  const out: string[] = [];
  if (order.customId !== deal.id) out.push(`custom_id ${order.customId}`);
  if (order.amount.currency !== deal.amount.currency || Number(order.amount.value) !== Number(deal.amount.value)) {
    out.push(`amount ${order.amount.value} ${order.amount.currency}`);
  }
  if (!payeeMatches(deal.seller, order.payee)) out.push(`payee ${order.payee.merchantId ?? order.payee.email}`);
  return out;
}

async function record(deal: Deal, order: CapturedOrder): Promise<SettleResult> {
  const capture = order.capture!;
  const payment: Payment = {
    orderId: order.orderId,
    captureId: capture.id,
    status: capture.status,
    value: capture.value,
    currency: capture.currency,
    paidAt: Date.now(),
    payee: order.payee,
    payeeMatches: payeeMatches(deal.seller, order.payee),
    payer: order.payer,
    sellerProtection: capture.sellerProtection,
  };
  await deals.setPayment(deal.id, payment); // false = already recorded by another request: fine
  return capture.status === "COMPLETED" ? "paid" : "pending";
}

export async function settle(deal: Deal, orderId: string): Promise<SettleResult> {
  const order = await getOrder(orderId);
  const issues = problems(deal, order);
  if (issues.length) {
    console.error("order rejected before capture", { deal: deal.id, order: orderId, issues });
    return "rejected";
  }
  if (order.status === "COMPLETED" && order.capture) return record(deal, order);
  if (order.status !== "APPROVED") return "not_approved";

  let captured: CapturedOrder;
  try {
    captured = await captureOrder(orderId);
  } catch (err) {
    const detail = err instanceof PayPalError ? JSON.stringify(err.body) : String(err);
    console.error("capture failed", { deal: deal.id, order: orderId, detail });
    return "failed";
  }
  if (!captured.capture || !["COMPLETED", "PENDING"].includes(captured.capture.status)) {
    console.error("capture not completed", { deal: deal.id, order: orderId, status: captured.capture?.status });
    return "failed";
  }
  return record(deal, captured);
}

// Called by the deal page when a buyer was sent to PayPal but no payment is recorded:
// if PayPal already has a capture for that order, record it. Never captures.
export async function reconcile(deal: Deal): Promise<Deal> {
  if (deal.payment || !deal.pendingOrderId) return deal;
  try {
    const order = await getOrder(deal.pendingOrderId);
    if (order.status === "COMPLETED" && order.capture && !problems(deal, order).length) {
      await record(deal, order);
      return (await deals.get(deal.id)) ?? deal;
    }
  } catch (err) {
    console.error("reconcile failed", { deal: deal.id, detail: String(err) });
  }
  return deal;
}
