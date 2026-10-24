import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Backfill + reparație: stampilează Property.poster_plan pentru TOATE anunțurile,
// pe baza abonamentelor active. Rulează o dată după publish (Subscription.read
// e blocat la owner/admin, deci frontend-ul nu mai poate construi harta
// user->plan din browser — ordonarea pe planuri citește acum poster_plan).
// Doar admin. Idempotent — poate fi rulat oricând, de exemplu după ce un
// abonament expiră sau se schimbă manual.
const ADMIN_ROLES = new Set(["admin", "ADMIN", "SUPER_ADMIN", "super_admin"]);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id || !ADMIN_ROLES.has(me.role)) {
      return Response.json({ error: "Doar administratorii pot rula sincronizarea." });
    }

    const svc = base44.asServiceRole;

    // user_id -> plan_id, cel mai recent abonament activ câștigă
    const subs = await svc.entities.Subscription.filter({ status: "active" }, "-started_date", 500);
    const planByUser = new Map<string, string>();
    for (const s of subs) {
      if (s.user_id && s.plan_id && !planByUser.has(s.user_id)) planByUser.set(s.user_id, s.plan_id);
    }

    const properties = await svc.entities.Property.list("-created_date", 1000);
    let updated = 0;
    let failed = 0;
    const updates: any[] = [];
    for (const p of properties) {
      const should = planByUser.get(p.created_by_id) || null;
      const current = p.poster_plan || null;
      // null, nu "": enum-ul câmpului e basic|pro|agent, iar un șir gol în
      // afara enum-ului face bulkUpdate-ul de mai jos să crape pe tot lotul.
      if (should !== current) updates.push({ id: p.id, poster_plan: should || null });
    }
    // bulkUpdate în loturi de 100 — vezi regula bulk din platformă
    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100);
      try { await svc.entities.Property.bulkUpdate(batch); updated += batch.length; }
      catch (_) {
        for (const u of batch) {
          try { await svc.entities.Property.update(u.id, { poster_plan: u.poster_plan }); updated++; } catch (_) { failed++; }
        }
      }
    }

    return Response.json({ ok: true, subscriptions: subs.length, properties: properties.length, updated, failed });
  } catch (e) {
    return Response.json({ error: e?.message || "Eroare la sincronizare." });
  }
}
