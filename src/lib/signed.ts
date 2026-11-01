// Tiny HMAC-signed tokens (server-only). Used for the seller session cookie.
import { createHmac, timingSafeEqual } from "node:crypto";

function key() {
  // APP_SECRET is preferred; falls back to a key derived from the PayPal secret so a
  // fresh deploy works without extra configuration.
  const secret = process.env.APP_SECRET ?? process.env.PAYPAL_CLIENT_SECRET;
  if (!secret) throw new Error("Missing APP_SECRET (or PAYPAL_CLIENT_SECRET)");
  return createHmac("sha256", "liveproof-signing-v1").update(secret).digest();
}

export function sign(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", key()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function unsign<T>(token: string | undefined | null): T | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", key()).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
