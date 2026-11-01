// Minimal PayPal sandbox helpers (server-only).
const API = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";
const WEB = process.env.PAYPAL_WEB_BASE ?? "https://www.sandbox.paypal.com";

function basicAuth() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export function baseUrl() {
  const url = process.env.PUBLIC_BASE_URL;
  if (!url) throw new Error("Missing PUBLIC_BASE_URL");
  return url.replace(/\/$/, "");
}

export const LOGIN_CALLBACK_PATH = "/api/auth/paypal/callback";

// Scopes: OpenID basics + PayPal attributes (payer_id, verified_account).
const LOGIN_SCOPES = "openid profile email https://uri.paypal.com/services/paypalattributes";

export function loginUrl(state: string) {
  const params = new URLSearchParams({
    flowEntry: "static",
    client_id: process.env.PAYPAL_CLIENT_ID ?? "",
    response_type: "code",
    scope: LOGIN_SCOPES,
    redirect_uri: baseUrl() + LOGIN_CALLBACK_PATH,
    state,
  });
  return `${WEB}/connect?${params.toString()}`;
}

export type PayPalIdentity = {
  user_id?: string;
  payer_id?: string;
  name?: string;
  email?: string;
  verified_account?: boolean | string;
  account_type?: string;
};

export async function identityFromCode(code: string): Promise<PayPalIdentity> {
  const tokenRes = await fetch(`${API}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code }).toString(),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}: ${JSON.stringify(token)}`);

  const infoRes = await fetch(`${API}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const info = await infoRes.json();
  if (!infoRes.ok) throw new Error(`userinfo ${infoRes.status}: ${JSON.stringify(info)}`);

  const email =
    info.email ?? info.emails?.find((e: { primary?: boolean }) => e.primary)?.value ?? info.emails?.[0]?.value;
  return {
    user_id: info.user_id,
    payer_id: info.payer_id,
    name: info.name,
    email,
    verified_account: info.verified_account,
    account_type: info.account_type,
  };
}
