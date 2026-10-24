import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { addCredits, normaliseCode } from "../../shared/boosts.js";

// Revendicarea unui cupon. TOATĂ validarea stă aici, server-side: entitatea
// Coupon are read blocat la admin tocmai ca browserul să nu poată enumera
// toate codurile prin API-ul public.
//
// Fiecare cauză de eșec întoarce mesajul ei, ca utilizatorul să știe dacă a
// greșit codul, dacă a expirat sau dacă l-a folosit deja.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat.", error_en: "You need to be signed in." });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const code = normaliseCode(body?.code);
    if (!code) return Response.json({ error: "Introdu un cod.", error_en: "Enter a code." });

    const svc = base44.asServiceRole;

    const found = await svc.entities.Coupon.filter({ code }, "-created_date", 1);
    const coupon: any = found[0];
    if (!coupon) {
      return Response.json({ error: "Cod inexistent.", error_en: "That code does not exist." });
    }
    if (coupon.active === false) {
      return Response.json({ error: "Codul nu mai este activ.", error_en: "That code is no longer active." });
    }
    if (coupon.expires_date && new Date(coupon.expires_date).getTime() < Date.now()) {
      return Response.json({ error: "Codul a expirat.", error_en: "That code has expired." });
    }
    const maxUses = Number(coupon.max_uses) || 0;
    if (maxUses > 0 && (Number(coupon.uses_count) || 0) >= maxUses) {
      return Response.json({ error: "Codul a atins numărul maxim de utilizări.", error_en: "That code has reached its usage limit." });
    }

    const prior = await svc.entities.CouponRedemption.filter({ coupon_id: coupon.id, user_id: me.id }, "-created_date", 1);
    if (prior.length) {
      return Response.json({ error: "Ai folosit deja acest cod.", error_en: "You have already used this code." });
    }

    const boosts = Number(coupon.bonus_boosts) || 0;
    if (boosts < 1) {
      return Response.json({ error: "Codul nu acordă boost-uri.", error_en: "That code grants no boosts." });
    }

    // Marcăm întâi consumul, apoi acordăm creditele: dacă a doua scriere
    // eșuează, utilizatorul rămâne fără credite (reparabil manual), ceea ce e
    // preferabil unui cod care poate fi revendicat de mai multe ori.
    await svc.entities.CouponRedemption.create({
      coupon_id: coupon.id, code, user_id: me.id, boosts_granted: boosts,
    });
    await svc.entities.Coupon.update(coupon.id, { uses_count: (Number(coupon.uses_count) || 0) + 1 });

    const balance = await addCredits(svc, {
      userId: me.id, delta: boosts, reason: "coupon", sourceId: coupon.id, note: `Cod ${code}`,
    });

    return Response.json({ ok: true, boosts, balance });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Eroare la revendicarea codului." });
  }
}
