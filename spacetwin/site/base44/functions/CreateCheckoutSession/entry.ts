import { secrets } from "base44:runtime";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getStripeKey } from "../../shared/stripeKey.js";

// Creează o sesiune Stripe Checkout (mod abonament) pentru planul + intervalul
// cerut din pagina „Planuri Upgrade” și returnează URL-ul de plată către care
// frontend-ul redirecționează browserul. Cheia secretă Stripe rămâne doar pe
// server — secretul StripeSecretKey (LIVE, 23.08 — înlocuiește StripeTest
// folosit până azi pentru testare în Sandbox).
//
// Prețurile sunt cele create în Stripe (mod LIVE, 23.08) pentru VerifiCasa
// Basic/Pro/Agent, lunar + anual, în RON — vezi PlanuriUpgrade.jsx pentru
// sumele afișate în UI.
const PRICE_MAP: Record<string, { monthly: string; yearly: string }> = {
  basic: { monthly: "price_1U4luqPq70JhwVjjB0qJtPFy", yearly: "price_1U4luqPq70JhwVjjFY0SDXvN" },
  pro: { monthly: "price_1U4lunPq70JhwVjjlRKp54aL", yearly: "price_1U4lunPq70JhwVjjXUSGSSx4" },
  agent: { monthly: "price_1U4lulPq70JhwVjjfToP9I6A", yearly: "price_1U4lulPq70JhwVjjuGIg4MmA" },
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    // Notă: răspundem mereu cu status 200 și un câmp `error` (nu coduri HTTP 4xx/5xx)
    // pentru că SDK-ul base44 din browser aruncă o eroare generică pe orice status
    // non-2xx și mesajul nostru detaliat nu mai ajunge la utilizator.
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });

    const secretKey = getStripeKey(secrets);
    if (!secretKey) {
      return Response.json({ error: "Plățile nu sunt configurate încă — lipsește cheia Stripe." });
    }

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const { plan_id, interval } = body || {};
    // Price ID-ul curent vine din PlanConfig — la o schimbare de preț din
    // Admin, AdminUpdatePlanConfig rotește prețul în Stripe și scrie aici noul
    // ID, deci checkout-ul folosește instant prețul nou. PRICE_MAP e fallback.
    let priceId = PRICE_MAP[plan_id]?.[interval] || "";
    try {
      const rows = await base44.asServiceRole.entities.PlanConfig.filter({ plan_id }, "-updated_date", 1);
      const dbId = interval === "yearly" ? rows?.[0]?.stripe_price_yearly_id : rows?.[0]?.stripe_price_monthly_id;
      if (dbId) priceId = dbId;
    } catch (_) { /* fallback pe PRICE_MAP */ }
    if (!priceId) {
      return Response.json({ error: "Plan sau interval de facturare necunoscut." });
    }

    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://verificasa.ro";
    const baseUrl = origin.replace(/\/$/, "").replace(/\/upgrade.*$/, "");

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("success_url", `${baseUrl}/upgrade?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${baseUrl}/upgrade?checkout=cancelled`);
    params.set("client_reference_id", me.id);
    if (me.email) params.set("customer_email", me.email);
    params.set("metadata[plan_id]", plan_id);
    params.set("metadata[user_id]", me.id);
    params.set("subscription_data[metadata][plan_id]", plan_id);
    params.set("subscription_data[metadata][user_id]", me.id);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const sessionJson = await stripeRes.json().catch(() => null);
    if (!stripeRes.ok || !sessionJson?.url) {
      const detail = sessionJson?.error?.message || `Stripe a refuzat cererea (HTTP ${stripeRes.status}).`;
      return Response.json({ error: detail });
    }

    return Response.json({ ok: true, url: sessionJson.url });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) });
  }
}