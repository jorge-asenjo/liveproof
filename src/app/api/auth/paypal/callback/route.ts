import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { baseUrl, identityFromCode } from "@/lib/paypal";
import { getSeller, setSeller } from "@/lib/session";

// PayPal redirects here after the seller logs in. The verified identity is stored in a
// signed cookie and the seller continues to /sell. /api/auth/me shows what was stored.
// Failures go back to /sell with a notice and a "Log in again" button, never raw JSON.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expected = cookieStore.get("lipp_state")?.value;
  cookieStore.delete("lipp_state");

  if (!code || !state || state !== expected) {
    // A replayed callback (e.g. Render's wake-up page reloading it) after a login that
    // already worked: the seller is in, so just continue.
    if (await getSeller()) return Response.redirect(`${baseUrl()}/sell`, 303);
    // Most often the login page stayed open longer than the 30 min state cookie.
    console.warn("login callback rejected", { hasCode: !!code, hasState: !!state, hasCookie: !!expected });
    return Response.redirect(`${baseUrl()}/sell?login=expired`, 303);
  }
  try {
    const identity = await identityFromCode(code);
    await setSeller(identity);
    return Response.redirect(`${baseUrl()}/sell`, 303);
  } catch (err) {
    console.error("paypal login failed", String(err));
    return Response.redirect(`${baseUrl()}/sell?login=failed`, 303);
  }
}
