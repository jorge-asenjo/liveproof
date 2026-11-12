import { ChallengeError, DEAL_WINDOW_MS, getOwnedChallenge, newId, sellerId, store } from "@/lib/challenge";
import { DEAL_CURRENCIES, deals, parseAmount, type Deal } from "@/lib/deals";
import { baseUrl } from "@/lib/paypal";
import { getSeller } from "@/lib/session";

// Turns a live proof that passed into a buyer link. The seller only chooses the price:
// the account that gets paid is the PayPal account logged in for this proof.
export async function POST(request: Request) {
  const seller = await getSeller();
  if (!seller) return Response.json({ error: "Log in with PayPal first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  let challenge;
  try {
    challenge = getOwnedChallenge(String(body?.challengeId ?? ""), seller);
  } catch (err) {
    if (err instanceof ChallengeError) return Response.json({ error: "Live proof not found. Do it again." }, { status: err.status });
    throw err;
  }
  if (challenge.dealId) return Response.json({ id: challenge.dealId, url: `${baseUrl()}/deal/${challenge.dealId}` });
  if (challenge.status !== "passed" || !challenge.decision || !challenge.observation || !challenge.verify) {
    return Response.json({ error: "Only a live proof that passed can become a buyer link" }, { status: 409 });
  }
  if (Date.now() - (challenge.moment2At ?? 0) > DEAL_WINDOW_MS) {
    return Response.json({ error: "This live proof is too old. Do a new one." }, { status: 410 });
  }

  const value = parseAmount(body?.amount);
  if (!value) return Response.json({ error: "Enter a price between 0.01 and 10,000" }, { status: 400 });
  const listed = challenge.listing.currency?.toUpperCase();
  const currency = (DEAL_CURRENCIES as readonly string[]).includes(listed) ? listed : "USD";

  const deal: Deal = {
    id: newId(),
    createdAt: Date.now(),
    seller: {
      payerId: challenge.seller.payer_id ?? null,
      userId: challenge.seller.user_id ?? null,
      name: challenge.seller.name ?? "PayPal user",
      email: challenge.seller.email ?? null,
      verified: challenge.seller.verified_account === true || challenge.seller.verified_account === "true",
    },
    item: { title: challenge.listing.title, category: challenge.listing.category, condition: challenge.listing.condition },
    amount: { value, currency },
    proof: {
      provedAt: challenge.moment2At!,
      code: challenge.code,
      gestureA: challenge.gestureA,
      gestureB: challenge.gestureB!,
      gestureBDelayMs: (challenge.moment2At ?? 0) - (challenge.gestureBIssuedAt ?? 0),
      checks: challenge.decision.checks,
      seen: challenge.observation.item_description,
      observation: challenge.observation,
      // Shown to the buyer: someone who keeps retrying until a fake gets through stands out.
      failedBefore: [...store.challenges.values()].filter(
        (c) =>
          c.id !== challenge.id &&
          sellerId(c.seller) === sellerId(challenge.seller) &&
          c.status === "failed" &&
          c.createdAt < challenge.createdAt &&
          challenge.createdAt - c.createdAt < 60 * 60_000,
      ).length,
      model: challenge.verify.model,
      verifyMs: challenge.verify.latencyMs,
    },
    frameCount: 2,
    payment: null,
  };
  // One frame per moment: the code with the first gesture, then the surprise gesture.
  const frames = [challenge.moment1![0], challenge.moment2![0]];
  challenge.dealId = deal.id; // set before saving, so a double click cannot make two links
  try {
    await deals.create(deal, frames);
  } catch (err) {
    challenge.dealId = undefined;
    console.error("deal create failed", err);
    return Response.json({ error: "Could not save the buyer link. Try again." }, { status: 502 });
  }
  return Response.json({ id: deal.id, url: `${baseUrl()}/deal/${deal.id}` });
}
