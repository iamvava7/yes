// Cheia Stripe LIVE. Numele istoric al secretului e StripeSecretKey; clientul
// a confirmat (23.08) că cheia live stă în StripePaymentMethodVC. Se încearcă
// în ordine, ca funcțiile vechi să meargă indiferent care dintre ele e setat.
export function getStripeKey(secrets) {
  return secrets.get("StripeSecretKey") || secrets.get("StripePaymentMethodVC") || null;
}

// Apel simplu la API-ul Stripe (form-encoded, cum cere v1).
export async function stripeCall(secretKey, method, path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params ? params.toString() : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error?.message || `Stripe a refuzat cererea (HTTP ${res.status}).`);
  }
  return json;
}