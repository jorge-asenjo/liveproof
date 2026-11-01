import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { baseUrl, identityFromCode } from "@/lib/paypal";
import { setSeller } from "@/lib/session";

// PayPal redirects here after the seller logs in. The verified identity is stored in a
// signed cookie and the seller continues to /sell. /api/auth/me shows what was stored.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expected = cookieStore.get("lipp_state")?.value;
  cookieStore.delete("lipp_state");

  if (!code || !state || state !== expected) {
    return Response.json({ error: "invalid_login_callback" }, { status: 400 });
  }
  try {
    const identity = await identityFromCode(code);
    await setSeller(identity);
    return Response.redirect(`${baseUrl()}/sell`, 303);
  } catch (err) {
    return Response.json({ error: "paypal_login_failed", detail: String(err) }, { status: 502 });
  }
}
