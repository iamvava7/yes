import { base44 } from "@/api/base44Client";

// Plata de boost-uri ÎN PAGINĂ (Stripe Payment Element), cu tot ce-i trebuie:
// scriptul Stripe, intenția de plată, verificarea și aspectul luat din
// tokenurile site-ului. Checkout-ul găzduit rămâne doar fallback, când cheia
// publică nu e încă în secretele aplicației.
//
// Stripe.js se încarcă DOAR de la js.stripe.com (regula lor de PCI) printr-un
// <script> la prima nevoie — nu e pachet npm, deci nu atinge fluxul de
// instalare al platformei.

let stripeJsPromise = null;
export function loadStripeJs() {
  if (typeof window !== "undefined" && window.Stripe) return Promise.resolve();
  if (stripeJsPromise) return stripeJsPromise;
  stripeJsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { stripeJsPromise = null; reject(new Error("stripe.js nu s-a încărcat")); };
    document.head.appendChild(s);
  });
  return stripeJsPromise;
}

function unwrap(res) {
  return res?.data || res || {};
}

export async function createBoostPaymentIntent(packId) {
  try {
    return unwrap(await base44.functions.invoke("CreateBoostPaymentIntent", { pack_id: packId }));
  } catch (e) {
    return { error: e?.message || "Nu am putut porni plata." };
  }
}

export async function verifyBoostPayment(paymentIntentId) {
  try {
    return unwrap(await base44.functions.invoke("VerifyBoostPayment", { payment_intent_id: paymentIntentId }));
  } catch (e) {
    return { error: e?.message || "Nu am putut confirma plata." };
  }
}

// Fallback: checkout-ul găzduit, în filă NOUĂ, ca pagina curentă (formularul
// pe jumătate completat, ecranul de succes) să rămână exact unde e. Soldul se
// recitește la revenirea în filă — paginile care vând au deja ascultătorul.
export async function startHostedBoostCheckout(packId) {
  try {
    const res = await base44.functions.invoke("CreateBoostCheckout", { pack_id: packId });
    const d = unwrap(res);
    if (d.url) {
      window.open(d.url, "_blank", "noopener");
      return { opened: true };
    }
    return { error: d.error || "Nu am putut porni plata." };
  } catch (e) {
    return { error: "Nu am putut porni plata." };
  }
}

// Aspectul Payment Element, citit din tokenurile site-ului ÎN MOMENTUL
// deschiderii — așa plata arată ca aplicația în ambele teme, fără o a doua
// listă de culori care să rămână în urmă.
export function stripeAppearance() {
  const cs = getComputedStyle(document.documentElement);
  const hsl = (name, fallback) => {
    const v = cs.getPropertyValue(name).trim();
    return v ? `hsl(${v})` : fallback;
  };
  return {
    variables: {
      colorPrimary: hsl("--primary", "#1F7048"),
      colorBackground: hsl("--card", "#FBFAF7"),
      colorText: hsl("--foreground", "#161C29"),
      colorTextSecondary: hsl("--muted-foreground", "#5A6169"),
      colorDanger: hsl("--destructive", "#B32222"),
      borderRadius: "12px",
      fontFamily: "'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif",
    },
    rules: {
      ".Input": { borderColor: hsl("--border", "#DDD8CC"), boxShadow: "none" },
      ".Input:focus": { borderColor: hsl("--primary", "#1F7048"), boxShadow: "none" },
    },
  };
}

export const STRIPE_FONTS = [
  { cssSrc: "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700&display=swap" },
];
