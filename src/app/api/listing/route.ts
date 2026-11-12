import { BudgetError, clientIp, spendClaudeCall } from "@/lib/budget";
import { newId, sellerId, store } from "@/lib/challenge";
import { parseListing } from "@/lib/listing";
import { getSeller } from "@/lib/session";

// The seller pastes their listing; Claude extracts the item and a detail to show on camera.
export async function POST(request: Request) {
  const seller = await getSeller();
  if (!seller) return Response.json({ error: "Log in with PayPal first" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < 10 || text.length > 5000) {
    return Response.json({ error: "Paste the listing text (10 to 5000 characters)" }, { status: 400 });
  }
  try {
    await spendClaudeCall(clientIp(request));
    const listing = await parseListing(text);
    const draft = { id: newId(), sellerId: sellerId(seller), listingText: text, listing, createdAt: Date.now() };
    store.drafts.set(draft.id, draft);
    return Response.json({ draftId: draft.id, listing });
  } catch (err) {
    if (err instanceof BudgetError) return Response.json({ error: err.message }, { status: err.status });
    console.error("listing parse failed", err);
    return Response.json({ error: "Could not read the listing. Try again." }, { status: 502 });
  }
}
