import { secrets } from "base44:runtime";
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPlanLimits } from "../../shared/planConfig.js";
import { addCredits } from "../../shared/boosts.js";
import { getStripeKey } from "../../shared/stripeKey.js";

// Verifică server-side o sesiune Stripe Checkout finalizată (după redirectul de
// succes din CreateCheckoutSession) și salvează abonamentul rezultat pe entitatea
// Subscription — singura sursă de adevăr pentru „ce plan are acest utilizator".
// Scrierea folosește asServiceRole în mod deliberat: Subscription are RLS care
// blochează create/update din browser (vezi schema entității), tocmai ca un
// utilizator să nu-și poată auto-acorda un plan editând direct din client.
//
// Notă: răspundem mereu cu status 200 și un câmp `error` (nu coduri HTTP
// 4xx/5xx), la fel ca restul funcțiilor din acest proiect.
const PLAN_NAMES: Record<string, string> = {
  basic: "VerifiCasa Basic",
  pro: "VerifiCasa Pro",
  agent: "VerifiCasa Agent",
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const sessionId = body?.session_id;
    if (!sessionId) return Response.json({ error: "session_id lipsă." });

    const secretKey = getStripeKey(secrets);
    if (!secretKey) {
      return Response.json({ error: "Plățile nu sunt configurate încă — lipsește cheia Stripe." });
    }

    const svc = base44.asServiceRole;

    // Idempotent — dacă sesiunea a fost deja procesată (ex: userul reîncarcă
    // pagina de succes), întoarce direct rezultatul existent fără a duplica.
    const already = await svc.entities.Subscription.filter(
      { stripe_checkout_session_id: sessionId },
      "-created_date",
      1
    );
    if (already.length) {
      const s = already[0];
      return Response.json({ ok: true, plan_id: s.plan_id, current_period_end: s.current_period_end || null, already_processed: true });
    }

    const stripeRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription&expand[]=subscription.items.data.price`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const session: any = await stripeRes.json().catch(() => null);
    if (!stripeRes.ok || !session) {
      const detail = session?.error?.message || `Stripe a refuzat cererea (HTTP ${stripeRes.status}).`;
      return Response.json({ error: detail });
    }

    if (session.payment_status !== "paid" || session.status !== "complete") {
      return Response.json({ error: "Plata nu este confirmată încă." });
    }

    // Sesiunea trebuie să aparțină exact utilizatorului care cere verificarea —
    // altfel oricine ar putea trimite un session_id străin și fura un plan.
    const sessionUserId = session.client_reference_id || session.metadata?.user_id;
    if (sessionUserId !== me.id) {
      return Response.json({ error: "Sesiunea de plată nu îți aparține." });
    }

    const planId = session.metadata?.plan_id;
    if (!planId || !PLAN_NAMES[planId]) {
      return Response.json({ error: "Plan necunoscut în sesiunea de plată." });
    }

    const sub: any = session.subscription || null;
    const item0 = sub?.items?.data?.[0];
    // current_period_end s-a mutat pe SubscriptionItem în versiunile recente ale
    // API-ului Stripe — verificăm ambele locații, ca să funcționeze indiferent
    // de versiunea de API pe care e fixat contul conectat.
    const periodEndUnix = sub?.current_period_end ?? item0?.current_period_end ?? null;
    const periodStartUnix = sub?.current_period_start ?? item0?.current_period_start ?? null;
    const interval = item0?.price?.recurring?.interval === "year" ? "yearly" : "monthly";

    const record: any = {
      user_id: me.id,
      user_name: me.full_name || me.email || "",
      plan_id: planId,
      status: "active",
      billing_interval: interval,
      started_date: periodStartUnix ? new Date(periodStartUnix * 1000).toISOString() : new Date().toISOString(),
      stripe_customer_id: session.customer || "",
      stripe_subscription_id: sub?.id || "",
      stripe_checkout_session_id: sessionId,
      amount_ron: typeof session.amount_total === "number" ? session.amount_total / 100 : 0,
    };
    if (periodEndUnix) record.current_period_end = new Date(periodEndUnix * 1000).toISOString();

    // Un singur abonament „activ" per utilizator — orice rânduri anterioare
    // active devin „cancelled" ca să nu existe ambiguitate la citire.
    try {
      const prevActive = await svc.entities.Subscription.filter({ user_id: me.id, status: "active" }, "-started_date", 20);
      for (const row of prevActive) {
        await svc.entities.Subscription.update(row.id, { status: "cancelled" });
      }
    } catch (_) { /* best-effort */ }

    await svc.entities.Subscription.create(record);

    // Boost-urile incluse in plan intra in registrul BoostCredit CHIAR ACUM.
    // Pana azi, "2x Boosts" pe pagina de planuri nu credita nimic nicaieri:
    // cifra era doar text. Registrul e append-only, iar functia iese mai sus
    // daca sesiunea a fost deja procesata, deci creditarea se intampla exact o
    // data per sesiune de plata.
    //
    // ATENTIE, limita cunoscuta: se acorda LA ACTIVARE, nu lunar. Reinnoirile
    // Stripe nu trec prin nicio functie a aplicatiei (nu exista webhook), deci
    // luna a doua nu mai crediteaza nimic. Ca sa fie lunar, e nevoie de un
    // webhook pe `invoice.paid` care sa reia acest bloc.
    // Numărul de boost-uri incluse vine din PlanConfig (editabil din Admin),
    // cu fallback pe matricea statică.
    const ent = await getPlanLimits(svc, planId);
    if (ent.boostsIncluded > 0) {
      try {
        await addCredits(svc, {
          userId: me.id,
          delta: ent.boostsIncluded,
          reason: "plan_grant",
          sourceId: sessionId,
          note: `${PLAN_NAMES[planId]} - boost-uri incluse in plan`,
        });
      } catch (_) { /* best-effort: planul e activ chiar daca registrul cade */ }
    }

    // Denormalizează planul pe anunțurile utilizatorului. Ordonarea pe planuri
    // (homepage, căutare) citește Property.poster_plan — Subscription.read e
    // blocat la owner/admin, deci browserul nu mai poate construi harta
    // user->plan din abonamentele altora. Best-effort: SyncPosterPlans repară
    // oricând diferențele.
    try {
      const mine = await svc.entities.Property.filter({ created_by_id: me.id }, "-created_date", 200);
      const updates = (mine || [])
        .filter((p: any) => p.poster_plan !== planId)
        .map((p: any) => ({ id: p.id, poster_plan: planId }));
      if (updates.length) await svc.entities.Property.bulkUpdate(updates);
    } catch (_) { /* best-effort */ }

    return Response.json({ ok: true, plan_id: planId, plan_name: PLAN_NAMES[planId], current_period_end: record.current_period_end || null });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) });
  }
}