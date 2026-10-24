import { secrets } from "base44:runtime";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { BOOST_PACKS } from "../../shared/boosts.js";
import { getStripeKey } from "../../shared/stripeKey.js";

// Sesiune Stripe Checkout pentru un pachet de boost-uri. Spre deosebire de
// planuri, aici e mode=payment (plată unică), nu subscription.
//
// Prețurile sunt trimise inline (price_data), nu ca Price ID-uri pre-create,
// tocmai pentru că Andrei a spus că le schimbă — se editează într-un singur
// loc, în shared/boosts.js, fără să mai fie nevoie de nimic în Stripe.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });

    const secretKey = getStripeKey(secrets);
    if (!secretKey) return Response.json({ error: "Plățile nu sunt configurate încă." });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const packId = body?.pack_id;
    // Pachetul curent vine din BoostPackConfig (editabil din Admin → Planuri &
    // Prețuri) — prețul schimbat de admin e live la următorul checkout.
    // BOOST_PACKS static rămâne fallback.
    let pack: any = (BOOST_PACKS as any)[packId];
    try {
      const rows = await base44.asServiceRole.entities.BoostPackConfig.filter({ pack_id: packId }, "-updated_date", 1);
      if (rows?.[0]) {
        if (rows[0].active === false) return Response.json({ error: "Acest pachet nu mai este disponibil." });
        pack = {
          boosts: Number(rows[0].boosts) || 1,
          priceRon: Number(rows[0].price_ron) || 0,
          label: Number(rows[0].boosts) === 1 ? "1 boost" : `${rows[0].boosts} boost-uri`,
        };
      }
    } catch (_) { /* fallback pe BOOST_PACKS */ }
    if (!pack) return Response.json({ error: "Pachet de boost necunoscut." });

    const origin = req.headers.get("origin") || req.headers.get("referer") || "https://verificasa.ro";
    const baseUrl = origin.replace(/\/$/, "").replace(/\/(upgrade|account|my-properties).*$/, "");

    // Cumpărare de pe un anunț: creditul se aplică singur pe acel anunț la
    // întoarcerea din plată, ca „cumpără un boost" să fie un singur pas.
    // Verificăm proprietatea ACUM, ca omul să nu plătească pentru un anunț
    // pe care oricum nu-l poate promova.
    const propertyId = typeof body?.property_id === "string" ? body.property_id : "";
    if (propertyId) {
      const p: any = await base44.asServiceRole.entities.Property.get(propertyId).catch(() => null);
      if (!p) return Response.json({ error: "Anunțul nu a fost găsit." });
      if (p.created_by_id !== me.id) {
        return Response.json({ error: "Poți promova doar anunțurile tale." });
      }
      if (p.approval_status !== "APPROVED") {
        return Response.json({ error: "Anunțul trebuie aprobat înainte de a fi promovat." });
      }
    }

    const returnPath = propertyId ? "/my-properties" : "/account";

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "ron");
    params.set("line_items[0][price_data][unit_amount]", String(Math.round(pack.priceRon * 100)));
    params.set("line_items[0][price_data][product_data][name]", `VerifiCasa — ${pack.label}`);
    params.set("success_url", `${baseUrl}${returnPath}?boost=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${baseUrl}${returnPath}?boost=cancelled`);
    params.set("client_reference_id", me.id);
    if (me.email) params.set("customer_email", me.email);
    params.set("metadata[pack_id]", packId);
    params.set("metadata[user_id]", me.id);
    params.set("metadata[boosts]", String(pack.boosts));
    if (propertyId) params.set("metadata[property_id]", propertyId);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.url) {
      return Response.json({ error: json?.error?.message || `Stripe a refuzat cererea (HTTP ${res.status}).` });
    }
    return Response.json({ ok: true, url: json.url });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) });
  }
}