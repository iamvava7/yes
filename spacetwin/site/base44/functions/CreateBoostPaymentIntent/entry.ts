import { secrets } from "base44:runtime";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { BOOST_PACKS } from "../../shared/boosts.js";

// Plata în pagină (Stripe Payment Element), nu redirect pe checkout-ul găzduit:
// clientul a cerut ca pasul de plată să arate ca site-ul. Intenția de plată se
// creează aici; confirmarea o face browserul, în formularul nostru; creditarea
// o face VerifyBoostPayment, tot server-side, după ce Stripe zice „succeeded".
//
// Cheia PUBLICĂ vine din secretul `StripePublic` — perechea pk_test/pk_live a
// cheii din `StripeTest`, luată din dashboard-ul Stripe și pusă în secretele
// aplicației. Fără el, răspunsul e `embedded_unavailable` și interfața cade
// înapoi pe checkout-ul găzduit (CreateBoostCheckout), care merge oricum.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });

    const secretKey = (secrets.get("StripeSecretKey") || secrets.get("StripePaymentMethodVC"));
    if (!secretKey) return Response.json({ error: "Plățile nu sunt configurate încă." });
    const publishableKey = secrets.get("StripePublic");
    if (!publishableKey) return Response.json({ error: "embedded_unavailable" });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const packId = body?.pack_id;
    const pack = (BOOST_PACKS as any)[packId];
    if (!pack) return Response.json({ error: "Pachet de boost necunoscut." });

    const params = new URLSearchParams();
    params.set("amount", String(Math.round(pack.priceRon * 100)));
    params.set("currency", "ron");
    // Doar card: se confirmă în pagină, fără metode care pleacă pe redirect.
    params.set("payment_method_types[]", "card");
    params.set("description", `VerifiCasa — ${pack.label}`);
    if (me.email) params.set("receipt_email", me.email);
    params.set("metadata[pack_id]", packId);
    params.set("metadata[user_id]", me.id);
    params.set("metadata[boosts]", String(pack.boosts));

    const res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.client_secret) {
      return Response.json({ error: json?.error?.message || `Stripe a refuzat cererea (HTTP ${res.status}).` });
    }
    return Response.json({
      ok: true,
      client_secret: json.client_secret,
      publishable_key: publishableKey,
      amount: json.amount,
      currency: json.currency,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) });
  }
}