import { getSeller } from "@/lib/session";

// The PayPal identity bound to this browser session (for debugging and the seller page).
export async function GET() {
  const seller = await getSeller();
  if (!seller) return Response.json({ seller: null }, { status: 401 });
  return Response.json({ seller });
}
