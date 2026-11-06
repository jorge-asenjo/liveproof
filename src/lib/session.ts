// Seller session: the verified PayPal identity from Log in with PayPal, kept in a
// signed, httpOnly cookie. Server-only.
import { cookies } from "next/headers";
import type { PayPalIdentity } from "./paypal";
import { sign, unsign } from "./signed";

const COOKIE = "lp_seller";
const MAX_AGE_S = 2 * 60 * 60;

export type Seller = PayPalIdentity & { loggedInAt: number };

export async function setSeller(identity: PayPalIdentity) {
  const seller: Seller = { ...identity, loggedInAt: Date.now() };
  (await cookies()).set(COOKIE, sign(seller), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_S,
    path: "/",
  });
}

export async function getSeller(): Promise<Seller | null> {
  const seller = unsign<Seller>((await cookies()).get(COOKIE)?.value);
  if (seller && Date.now() - seller.loggedInAt < MAX_AGE_S * 1000) return seller;

  // Local development only: PayPal does not accept a localhost return URL, so the
  // login flow can only run on the deployed site. DEV_FAKE_SELLER=1 stands in for it.
  if (process.env.NODE_ENV !== "production" && process.env.DEV_FAKE_SELLER === "1") {
    return {
      user_id: "dev-user",
      payer_id: process.env.DEV_SELLER_PAYER_ID ?? "DEVPAYERID",
      name: "Dev Seller",
      email: process.env.SANDBOX_SELLER_EMAIL ?? "seller@example.com",
      verified_account: true,
      account_type: "PERSONAL",
      loggedInAt: Date.now(),
    };
  }
  return null;
}

export async function clearSeller() {
  (await cookies()).delete(COOKIE);
}
