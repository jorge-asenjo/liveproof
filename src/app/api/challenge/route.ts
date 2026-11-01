import { CODE_LENGTH, createChallenge, sellerId, store, WRITE_WINDOW_MS } from "@/lib/challenge";
import { getSeller } from "@/lib/session";

// Starts a live challenge for a parsed listing. The code is only revealed now, with the
// camera already on, so it cannot exist in any earlier photo or video.
export async function POST(request: Request) {
  const seller = await getSeller();
  if (!seller) return Response.json({ error: "Log in with PayPal first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const draft = typeof body?.draftId === "string" ? store.drafts.get(body.draftId) : undefined;
  if (!draft || draft.sellerId !== sellerId(seller)) {
    return Response.json({ error: "Listing not found. Paste it again." }, { status: 404 });
  }
  const challenge = createChallenge(draft, seller);
  return Response.json({
    id: challenge.id,
    code: challenge.code,
    codeLength: CODE_LENGTH,
    gestureA: challenge.gestureA,
    proofDetail: draft.listing.proof_detail,
    writeWindowMs: WRITE_WINDOW_MS,
  });
}
