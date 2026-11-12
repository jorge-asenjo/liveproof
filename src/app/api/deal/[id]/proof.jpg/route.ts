import type { NextRequest } from "next/server";
import { deals } from "@/lib/deals";
import { parseDataUrl } from "@/lib/verify";

// The first frame of the live proof as a .jpg URL. PayPal shows it as the item image in the
// checkout and in the shipment tracking, so the proof travels with the PayPal transaction.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/deal/[id]/proof.jpg">) {
  const { id } = await ctx.params;
  const dataUrl = await deals.frame(id, 0);
  if (!dataUrl) return new Response("Not found", { status: 404 });
  const { media_type, data } = parseDataUrl(dataUrl);
  return new Response(Buffer.from(data, "base64"), {
    headers: { "Content-Type": media_type, "Cache-Control": "public, max-age=86400, immutable" },
  });
}
