import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { identityFromCode } from "@/lib/paypal";

// PayPal redirects here after the seller logs in. For now it returns the verified
// identity as JSON; the real flow will store it and bind it to the live proof.
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
    return Response.json({ identity });
  } catch (err) {
    return Response.json({ error: "paypal_login_failed", detail: String(err) }, { status: 502 });
  }
}
