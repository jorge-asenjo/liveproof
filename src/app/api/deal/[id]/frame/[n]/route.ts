import type { NextRequest } from "next/server";
import { deals } from "@/lib/deals";
import { parseDataUrl } from "@/lib/verify";

// One frame of the live proof, as an image, for the buyer page.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/deal/[id]/frame/[n]">) {
  const { id, n } = await ctx.params;
  const index = Number(n);
  if (!Number.isInteger(index) || index < 0 || index > 9) return new Response("Not found", { status: 404 });
  const dataUrl = await deals.frame(id, index);
  if (!dataUrl) return new Response("Not found", { status: 404 });
  const { media_type, data } = parseDataUrl(dataUrl);
  return new Response(Buffer.from(data, "base64"), {
    headers: { "Content-Type": media_type, "Cache-Control": "private, max-age=86400, immutable" },
  });
}
