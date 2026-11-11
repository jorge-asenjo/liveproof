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

// ---------------------------------------------------------------------------
// Orders v2: the buyer pays the seller directly. LiveProof is never the payee.

let cachedToken: { value: string; expiresAt: number } | null = null;

async function appToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  const res = await fetch(`${API}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`oauth ${res.status}: ${JSON.stringify(body)}`);
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
  return cachedToken.value;
}

async function ordersCall(path: string, init: { method: string; body?: unknown; requestId?: string }) {
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${await appToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
  }
}

export type Payee = { merchant_id: string } | { email_address: string };

export type NewOrder = {
  dealId: string;
  description: string;
  amount: { value: string; currency: string };
  payee: Payee;
  returnUrl: string;
  cancelUrl: string;
};

// Creates the order with the payee fixed by the server. Returns the order id and the
// PayPal page where the buyer approves the payment.
export async function createOrder(order: NewOrder): Promise<{ id: string; approveUrl: string }> {
  const { ok, status, body } = await ordersCall("/v2/checkout/orders", {
    method: "POST",
    requestId: `create-${order.dealId}-${Date.now()}`,
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: order.dealId,
          custom_id: order.dealId,
          // One completed payment per deal: PayPal refuses a second payment with the same invoice id.
          invoice_id: `liveproof-${order.dealId}`,
          description: order.description.slice(0, 127),
          amount: { currency_code: order.amount.currency, value: order.amount.value },
          payee: order.payee,
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "PAY_NOW",
            shipping_preference: "GET_FROM_FILE",
            return_url: order.returnUrl,
            cancel_url: order.cancelUrl,
          },
        },
      },
    },
  });
  if (!ok) throw new PayPalError(`create order ${status}`, status, body);
  const approve = body.links?.find((l: { rel: string }) => l.rel === "payer-action" || l.rel === "approve");
  if (!approve?.href) throw new PayPalError("create order: no approval link", status, body);
  return { id: body.id, approveUrl: approve.href };
}

export type CapturedOrder = {
  orderId: string;
  status: string;
  customId: string | null;
  amount: { value: string | null; currency: string | null };
  payee: { merchantId: string | null; email: string | null };
  payer: { name: string | null; email: string | null };
  capture: { id: string; status: string; value: string; currency: string; sellerProtection: string | null } | null;
  approveUrl: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PayPal order JSON
function toCaptured(body: any): CapturedOrder {
  const unit = body.purchase_units?.[0] ?? {};
  const capture = unit.payments?.captures?.[0];
  const payerName = [body.payer?.name?.given_name, body.payer?.name?.surname].filter(Boolean).join(" ");
  return {
    orderId: body.id,
    status: body.status,
    customId: unit.custom_id ?? null,
    amount: { value: unit.amount?.value ?? null, currency: unit.amount?.currency_code ?? null },
    payee: { merchantId: unit.payee?.merchant_id ?? null, email: unit.payee?.email_address ?? null },
    payer: { name: payerName || null, email: body.payer?.email_address ?? null },
    capture: capture
      ? {
          id: capture.id,
          status: capture.status,
          value: capture.amount?.value,
          currency: capture.amount?.currency_code,
          sellerProtection: capture.seller_protection?.status ?? null,
        }
      : null,
    approveUrl: body.links?.find((l: { rel: string }) => l.rel === "payer-action" || l.rel === "approve")?.href ?? null,
  };
}

export async function getOrder(orderId: string): Promise<CapturedOrder> {
  const { ok, status, body } = await ordersCall(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
  if (!ok) throw new PayPalError(`get order ${status}`, status, body);
  return toCaptured(body);
}

// Captures an approved order. Safe to repeat: the request id makes PayPal return the
// first result, and an order that was already captured is read back instead.
export async function captureOrder(orderId: string): Promise<CapturedOrder> {
  const { ok, status, body } = await ordersCall(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    requestId: `capture-${orderId}`,
  });
  if (ok) return toCaptured(body);
  const issue = body?.details?.[0]?.issue;
  if (issue === "ORDER_ALREADY_CAPTURED") return getOrder(orderId);
  throw new PayPalError(`capture ${status}${issue ? ` ${issue}` : ""}`, status, body);
}

// ---------------------------------------------------------------------------

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
