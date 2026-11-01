import { NextResponse } from "next/server";
import { loginUrl } from "@/lib/paypal";

// Sends the seller to PayPal to log in. A random state protects the callback (CSRF).
export async function GET() {
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(loginUrl(state), 302);
  response.cookies.set("lipp_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1800, // the sandbox login can take a while (slow pages, retries)
  });
  return response;
}
