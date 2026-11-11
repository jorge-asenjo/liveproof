import { newId } from "@/lib/challenge";
import { deals, type Deal } from "@/lib/deals";
import { baseUrl } from "@/lib/paypal";
import { getSeller } from "@/lib/session";

// Local development only: creates a buyer link without doing a live proof, to test the
// buyer page and the payment. Disabled in production and without DEV_FAKE_SELLER=1.
const GREY_PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN89+7dfwAI8QPaBKDUBQAAAABJRU5ErkJggg==";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" || process.env.DEV_FAKE_SELLER !== "1") {
    return Response.json({ error: "Not available" }, { status: 404 });
  }
  const seller = (await getSeller())!;
  const now = Date.now();
  const deal: Deal = {
    id: newId(),
    createdAt: now,
    seller: {
      payerId: seller.payer_id ?? null,
      userId: seller.user_id ?? null,
      name: seller.name ?? "Dev Seller",
      email: seller.email ?? null,
      verified: true,
    },
    item: { title: "NVIDIA RTX 3080 Founders Edition", category: "graphics card", condition: "Used, never mined" },
    amount: { value: "450.00", currency: "USD" },
    proof: {
      provedAt: now - 2 * 60_000,
      code: "K7MRA",
      gestureA: "Victory",
      gestureB: "Thumb_Up",
      gestureBDelayMs: 3200,
      checks: [
        { id: "fresh_code", label: "Fresh code K7MRA handwritten on paper", ok: true, hard: true },
        { id: "gesture_a", label: "First gesture ✌️ peace sign", ok: true, hard: true },
        { id: "gesture_b", label: "Surprise gesture 👍 thumbs up within 15 s", ok: true, hard: true },
        { id: "item", label: "Item matches the listing", ok: true, hard: true },
        { id: "physical", label: "Real object, not a screen or a printed photo", ok: true, hard: true },
        { id: "continuity", label: "Same scene in both moments", ok: true, hard: true },
        { id: "detail", label: "Requested detail visible", ok: false, hard: false },
      ],
      seen: "Black and silver graphics card on a wooden desk",
      model: "claude-opus-5-5",
      verifyMs: 4900,
      observation: {
        moment1: { handwritten_code: "K7MRA", code_medium: "handwritten_paper", gesture: "Victory", item_visible: true },
        moment2: { handwritten_code: "K7MRA", code_medium: "handwritten_paper", gesture: "Thumb_Up", item_visible: true },
        listed_item_expected_look: "Silver and black dual-fan card with a V-shaped silver frame",
        item_description: "Black and silver graphics card on a wooden desk",
        item_matches_listing: "yes",
        proof_detail_visible: false,
        item_is_physical: "physical_object",
        same_scene_both_moments: true,
        tampering_signs: [],
      },
    },
    frameCount: 2,
    payment: null,
  };
  // ?paid=1 previews the paid state (fake capture, nothing is charged).
  if (new URL(request.url).searchParams.get("paid") === "1") {
    deal.payment = {
      orderId: "DEV-ORDER",
      captureId: "DEV-CAPTURE",
      status: "COMPLETED",
      value: deal.amount.value,
      currency: deal.amount.currency,
      paidAt: now,
      payee: { merchantId: deal.seller.payerId, email: deal.seller.email },
      payeeMatches: true,
      payer: { name: "Alex Chen", email: null },
      sellerProtection: "ELIGIBLE",
    };
  }
  await deals.create(deal, [GREY_PIXEL, GREY_PIXEL]);
  return Response.json({ id: deal.id, url: `${baseUrl()}/deal/${deal.id}` });
}
