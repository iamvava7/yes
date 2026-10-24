import { secrets } from "base44:runtime";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { addCredits, boostEndsAt } from "../../shared/boosts.js";

// Confirmă server-side o plată de boost-uri și scrie creditele în registru.
// Idempotent pe session_id: o reîncărcare a paginii de succes nu dublează.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const sessionId = body?.session_id;
    if (!sessionId) return Response.json({ error: "session_id lipsă." });

    const secretKey = (secrets.get("StripeSecretKey") || secrets.get("StripePaymentMethodVC"));
    if (!secretKey) return Response.json({ error: "Plățile nu sunt configurate încă." });

    const svc = base44.asServiceRole;

    const already = await svc.entities.BoostCredit.filter({ source_id: sessionId }, "-created_date", 1);
    if (already.length) {
      return Response.json({ ok: true, already_processed: true, balance: already[0].balance_after });
    }

    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const session: any = await res.json().catch(() => null);
    if (!res.ok || !session) {
      return Response.json({ error: session?.error?.message || `Stripe a refuzat cererea (HTTP ${res.status}).` });
    }
    if (session.payment_status !== "paid" || session.status !== "complete") {
      return Response.json({ error: "Plata nu este confirmată încă." });
    }
    const sessionUserId = session.client_reference_id || session.metadata?.user_id;
    if (sessionUserId !== me.id) return Response.json({ error: "Sesiunea de plată nu îți aparține." });

    const boosts = parseInt(session.metadata?.boosts || "0", 10);
    if (!boosts || boosts < 1) return Response.json({ error: "Pachet necunoscut în sesiunea de plată." });

    let balance = await addCredits(svc, {
      userId: me.id, delta: boosts, reason: "purchase", sourceId: sessionId,
      note: `Pachet ${session.metadata?.pack_id || ""}`,
    });

    // Boost cumpărat direct de pe un anunț: îl aplicăm imediat, ca omul să nu
    // plătească și apoi să mai fie nevoit să apese încă un buton. Dacă aplicarea
    // eșuează, creditul rămâne în cont — nu se pierde nimic.
    const propertyId = session.metadata?.property_id || "";
    let appliedTo: string | null = null;
    let boostEndsDate: string | null = null;

    if (propertyId) {
      try {
        const p: any = await svc.entities.Property.get(propertyId);
        if (p && p.created_by_id === me.id && p.approval_status === "APPROVED") {
          // Boost-ul durează 21 de zile de la ACUM — vezi shared/boosts.js.
          const now = Date.now();
          boostEndsDate = boostEndsAt(now);

          await svc.entities.Boost.create({
            property_id: propertyId,
            user_id: me.id,
            starts_date: new Date(now).toISOString(),
            ends_date: boostEndsDate,
            status: "active",
            credits_spent: 1,
          });
          await svc.entities.Property.update(propertyId, {
            boost_active: true,
            boost_ends_date: boostEndsDate,
            // Boost-urile se aduna pe acelasi anunt - vezi ApplyBoost.
            boost_count: (Number(p.boost_count) || 0) + 1,
          });
          balance = await addCredits(svc, {
            userId: me.id, delta: -1, reason: "spend", sourceId: propertyId, note: p.title || "",
          });
          appliedTo = propertyId;
        }
      } catch (_) {
        // creditul rămâne în sold; utilizatorul îl poate aplica manual
      }
    }

    return Response.json({ ok: true, boosts, balance, applied_to: appliedTo, boost_ends_date: boostEndsDate });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) });
  }
}