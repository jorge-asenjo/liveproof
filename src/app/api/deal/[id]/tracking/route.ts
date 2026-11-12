import type { NextRequest } from "next/server";
import { deals } from "@/lib/deals";
import { addTracking, baseUrl, CARRIERS, PayPalError, type Carrier } from "@/lib/paypal";
import { getSeller } from "@/lib/session";

// The seller adds the shipment's tracking number. LiveProof registers it on the PayPal
// order (Orders v2 /track), with the item linked to the live proof, and PayPal emails the
// buyer the tracking. Only the PayPal account that did the proof can do this.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/deal/[id]/tracking">) {
  const { id } = await ctx.params;
  const dealUrl = `${baseUrl()}/deal/${encodeURIComponent(id)}`;
  const deal = await deals.get(id);
  if (!deal) return Response.redirect(`${baseUrl()}/deal/not-found`, 303);

  const seller = await getSeller();
  const isSeller =
    !!seller &&
    ((!!deal.seller.payerId && seller.payer_id === deal.seller.payerId) ||
      (!deal.seller.payerId && !!deal.seller.email && seller.email?.toLowerCase() === deal.seller.email.toLowerCase()));
  if (!isSeller) return Response.redirect(`${dealUrl}?tracking=not-seller`, 303);
  if (!deal.payment || deal.payment.status !== "COMPLETED" || !deal.payment.captureId) {
    return Response.redirect(`${dealUrl}?tracking=not-paid`, 303);
  }

  const form = await request.formData().catch(() => null);
  const trackingNumber = String(form?.get("tracking_number") ?? "").trim().replace(/\s+/g, "");
  const carrier = String(form?.get("carrier") ?? "") as Carrier;
  const carrierNameOther = String(form?.get("carrier_other") ?? "").trim();
  if (!/^[A-Za-z0-9-]{6,40}$/.test(trackingNumber) || !CARRIERS.includes(carrier) || (carrier === "OTHER" && !carrierNameOther)) {
    return Response.redirect(`${dealUrl}?tracking=invalid`, 303);
  }

  try {
    const { trackerId } = await addTracking({
      orderId: deal.payment.orderId,
      captureId: deal.payment.captureId,
      trackingNumber,
      carrier,
      carrierNameOther: carrierNameOther.slice(0, 64),
      item: { name: deal.item.title, url: dealUrl, imageUrl: `${baseUrl()}/api/deal/${encodeURIComponent(id)}/proof.jpg` },
    });
    await deals.setShipment(deal.id, {
      carrier: carrier === "OTHER" ? carrierNameOther.slice(0, 64) : carrier,
      trackingNumber,
      trackerId,
      addedAt: Date.now(),
    });
    console.log("tracking added", { deal: deal.id, order: deal.payment.orderId, trackerId });
    return Response.redirect(`${dealUrl}?tracking=added`, 303);
  } catch (err) {
    const detail = err instanceof PayPalError ? JSON.stringify(err.body) : String(err);
    console.error("tracking failed", { deal: deal.id, detail });
    return Response.redirect(`${dealUrl}?tracking=error`, 303);
  }
}
