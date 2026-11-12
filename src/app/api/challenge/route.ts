import { evalCaptureEnabled } from "@/lib/attempts";
import { BudgetError, clientIp, spendClaudeCall } from "@/lib/budget";
import { CODE_LENGTH, createChallenge, sellerId, store, WRITE_WINDOW_MS } from "@/lib/challenge";
import { parseEvalLabel } from "@/lib/eval-labels";
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

  // The verification at the end of the challenge is one Claude call: count it now, before
  // the seller writes the code, so nobody does the whole proof only to hit the daily limit.
  try {
    await spendClaudeCall(clientIp(request));
  } catch (err) {
    if (err instanceof BudgetError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }

  let evalLabel;
  if (evalCaptureEnabled(seller)) {
    evalLabel = parseEvalLabel(body?.evalLabel);
    if (!evalLabel) return Response.json({ error: "Pick an eval label first" }, { status: 400 });
  }
  const challenge = createChallenge(draft, seller, evalLabel ?? undefined);
  return Response.json({
    id: challenge.id,
    code: challenge.code,
    codeLength: CODE_LENGTH,
    gestureA: challenge.gestureA,
    proofDetail: draft.listing.proof_detail,
    writeWindowMs: WRITE_WINDOW_MS,
  });
}
