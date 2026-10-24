import { secrets } from "base44:runtime";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { addCredits } from "../../shared/boosts.js";

// Perechea lui CreateBoostPaymentIntent: după ce browserul confirmă plata în
// pagină, AICI se verifică la Stripe că intenția chiar e „succeeded" și abia
// apoi se scriu creditele — clientul nu e crezut pe cuvânt la bani.
// Idempotent pe payment_intent_id: un refresh sau un dublu-click nu creditează
// de două ori. Oglinda pe sesiuni e VerifyBoostCheckout.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const piId = typeof body?.payment_intent_id === "string" ? body.payment_intent_id : "";
    if (!piId) return Response.json({ error: "payment_intent_id lipsă." });

    const secretKey = secrets.get("StripeSecretKey") || secrets.get("StripePaymentMethodVC");
    if (!secretKey) return Response.json({ error: "Plățile nu sunt configurate încă." });

    const svc = base44.asServiceRole;

    const already = await svc.entities.BoostCredit.filter({ source_id: piId }, "-created_date", 1);
    if (already.length) {
      return Response.json({ ok: true, already_processed: true, balance: already[0].balance_after });
    }

    const res = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(piId)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const pi: any = await res.json().catch(() => null);
    if (!res.ok || !pi) {
      return Response.json({ error: pi?.error?.message || `Stripe a refuzat cererea (HTTP ${res.status}).` });
    }
    if (pi.status !== "succeeded") return Response.json({ error: "Plata nu este confirmată încă." });
    if (pi.metadata?.user_id !== me.id) return Response.json({ error: "Plata nu îți aparține." });

    const boosts = parseInt(pi.metadata?.boosts || "0", 10);
    if (!boosts || boosts < 1) return Response.json({ error: "Pachet necunoscut în plată." });

    const balance = await addCredits(svc, {
      userId: me.id, delta: boosts, reason: "purchase", sourceId: piId,
      note: `Pachet ${pi.metadata?.pack_id || ""}`,
    });

    return Response.json({ ok: true, boosts, balance });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) });
  }
}