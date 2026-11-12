"use client";

// PayPal's own button (JS SDK, v5). The order is created on our server with the payee fixed
// to the account that did the live proof; the button only receives its id, opens PayPal's
// popup, and then asks our server to check and capture. If the SDK cannot load, the
// full-page redirect below the button still works.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type PayPalNamespace = {
  Buttons: (options: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void>; isEligible?: () => boolean };
};
declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

export default function PayPalButton({ dealId, clientId, currency }: { dealId: string; clientId: string; currency: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed" | "working">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let leaving = false;
    const go = (param: string) => {
      leaving = true;
      router.replace(`/deal/${encodeURIComponent(dealId)}?payment=${param}`);
      router.refresh();
    };
    const render = () => {
      if (cancelled || !window.paypal || !ref.current) return;
      ref.current.innerHTML = "";
      window.paypal
        .Buttons({
          style: { layout: "vertical", color: "gold", shape: "pill", label: "pay", height: 48 },
          createOrder: async () => {
            setMessage(null);
            const res = await fetch(`/api/deal/${encodeURIComponent(dealId)}/order`, { method: "POST" });
            const body = await res.json().catch(() => ({}));
            if (body.settled) {
              go(body.settled);
              throw new Error("already settled");
            }
            if (!res.ok || !body.id) throw new Error(body.error ?? "Could not create the PayPal order");
            return body.id as string;
          },
          onApprove: async (data: { orderID: string }) => {
            setState("working");
            const res = await fetch(`/api/deal/${encodeURIComponent(dealId)}/capture`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderID: data.orderID }),
            });
            const body = await res.json().catch(() => ({}));
            go(body.param ?? "processing");
          },
          onCancel: () => setMessage("Payment cancelled. Nothing was charged."),
          onError: (err: unknown) => {
            if (leaving) return;
            console.error("paypal button error", err);
            setMessage("PayPal could not start the payment. Try again, or use the link below.");
          },
        })
        .render(ref.current)
        .then(() => !cancelled && setState("ready"))
        .catch(() => !cancelled && setState("failed"));
    };

    if (window.paypal) {
      render();
    } else {
      const src = `https://www.paypal.com/sdk/js?${new URLSearchParams({
        "client-id": clientId,
        currency,
        intent: "capture",
        components: "buttons",
        "disable-funding": "card,credit,paylater,venmo",
        locale: "en_US",
      })}`;
      let script = document.querySelector<HTMLScriptElement>("script[data-paypal-sdk]");
      if (!script) {
        script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.dataset.paypalSdk = "1";
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
      script.addEventListener("error", () => !cancelled && setState("failed"));
    }
    return () => {
      cancelled = true;
    };
  }, [dealId, clientId, currency, router]);

  return (
    <div className="flex flex-col gap-2">
      <div ref={ref} className={state === "working" ? "pointer-events-none opacity-50" : ""} />
      {state === "loading" && <p className="text-sm text-neutral-500">Loading PayPal…</p>}
      {state === "working" && <p className="text-sm text-neutral-600">Checking the order and completing the payment…</p>}
      {message && <p className="text-sm text-amber-800">{message}</p>}
      {state === "failed" && <p className="text-sm text-amber-800">The PayPal button could not load. Use the button below.</p>}
    </div>
  );
}
