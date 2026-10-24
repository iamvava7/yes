import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getEntitlements, stampPosterPlan } from "../../shared/entitlements.js";
import { addCredits } from "../../shared/boosts.js";

// Acordă un plan MANUAL, din panoul de admin — fără Stripe, fără bani.
// Face exact ce face VerifyCheckoutSession la o plată reușită: activează
// abonamentul, acordă boost-urile incluse o singură dată, și stampilează
// poster_plan pe toate anunțurile omului, ca badge-ul să apară imediat.
//
// Cererea clientului, 23.08: „atâta timp cât au plătit, primesc acel badge" —
// acest buton e calea de a acorda un plan controlat (nu editare directă pe
// tabelă din dashboard), ca stampilarea și boost-urile să se întâmple mereu
// împreună, niciodată uitate.
const ADMIN_ROLES = new Set(["admin", "ADMIN", "SUPER_ADMIN", "super_admin"]);
const PLAN_NAMES: Record<string, string> = {
  basic: "VerifiCasa Basic",
  pro: "VerifiCasa Pro",
  agent: "VerifiCasa Agent",
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id || !ADMIN_ROLES.has(me.role)) {
      return Response.json({ error: "Doar administratorii pot acorda planuri manual." });
    }

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const email = String(body?.email || "").trim().toLowerCase();
    const planId = body?.plan_id;
    const interval = body?.billing_interval === "yearly" ? "yearly" : "monthly";
    if (!email) return Response.json({ error: "Introdu emailul utilizatorului." });
    if (!PLAN_NAMES[planId]) return Response.json({ error: "Plan necunoscut." });

    const svc = base44.asServiceRole;

    const users = await svc.entities.User.filter({ email }, "-created_date", 1);
    const target = users?.[0];
    if (!target?.id) return Response.json({ error: `Niciun cont găsit cu emailul ${email}.` });

    // Un singur abonament „activ" per utilizator — la fel ca la o plată reală.
    try {
      const prevActive = await svc.entities.Subscription.filter({ user_id: target.id, status: "active" }, "-started_date", 20);
      for (const row of prevActive) {
        await svc.entities.Subscription.update(row.id, { status: "cancelled" });
      }
    } catch (_) { /* best-effort */ }

    const now = Date.now();
    const periodMs = interval === "yearly" ? 365 * 86400000 : 30 * 86400000;
    const record: any = {
      user_id: target.id,
      user_name: target.full_name || target.email || "",
      plan_id: planId,
      status: "active",
      billing_interval: interval,
      started_date: new Date(now).toISOString(),
      current_period_end: new Date(now + periodMs).toISOString(),
      stripe_customer_id: "",
      stripe_subscription_id: "",
      stripe_checkout_session_id: `manual:${me.id}:${now}`,
      amount_ron: 0,
      description: `Acordat manual de ${me.full_name || me.email} (fără plată Stripe)`,
    };
    const sub = await svc.entities.Subscription.create(record);

    // Boost-urile incluse în plan, o singură dată — la fel ca la o plată reală.
    const ent = getEntitlements(planId);
    if (ent.boostsIncluded > 0) {
      try {
        await addCredits(svc, {
          userId: target.id,
          delta: ent.boostsIncluded,
          reason: "plan_grant",
          sourceId: sub.id,
          note: `${PLAN_NAMES[planId]} — acordat manual de admin`,
        });
      } catch (_) { /* best-effort: planul e activ chiar dacă registrul cade */ }
    }

    // Badge-ul, imediat, pe toate anunțurile omului.
    await stampPosterPlan(svc, target.id, planId);

    // Notificare in-app — omul află că a primit planul, fără să aștepte un email de plată.
    try {
      await svc.entities.Notification.create({
        user_id: target.id,
        type: "system",
        text: `Ai primit planul ${PLAN_NAMES[planId]}.`,
        link: "/account",
        actor_name: "VerifiCasa",
        read: false,
      });
    } catch (_) { /* best-effort */ }

    return Response.json({
      ok: true,
      user_id: target.id,
      user_email: target.email,
      plan_id: planId,
      current_period_end: record.current_period_end,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) });
  }
}
