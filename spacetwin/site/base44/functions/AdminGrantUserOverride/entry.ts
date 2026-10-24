import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { addCredits } from "../../shared/boosts.js";

// Acordare manuală de extra-limite unui utilizator (Admin → Planuri & Prețuri):
// +N anunțuri active, +N tururi 3D (UserOverride, se ADUNĂ peste plan) și/sau
// credite de boost (registrul BoostCredit). NU schimbă planul utilizatorului.
// Permis TUTUROR rolurilor de admin (ADMIN are drept de grant, nu de editare
// a planurilor globale — aceea e treabă de SUPER_ADMIN).
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });
    const roleUp = (me.role || "").toUpperCase();
    const isAdmin = ADMIN_ROLES.includes(roleUp) || me.role === "admin";
    if (!isAdmin) return Response.json({ error: "Doar administratorii pot acorda extra-limite." });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const userId = body?.user_id;
    if (!userId) return Response.json({ error: "user_id lipsă." });

    const svc = base44.asServiceRole;
    const targets = await svc.entities.User.filter({ id: userId }, "-created_date", 1).catch(() => []);
    const target: any = targets?.[0];
    if (!target) return Response.json({ error: "Utilizatorul nu a fost găsit." });

    const results: string[] = [];

    // Extra-limite (upsert pe UserOverride)
    const hasLimits = body.extra_listings !== undefined || body.extra_tours !== undefined;
    if (hasLimits) {
      const rows = await svc.entities.UserOverride.filter({ user_id: userId }, "-updated_date", 1);
      const patch: any = {
        user_email: target.email || "",
        user_name: target.full_name || target.email || "",
        granted_by_name: me.full_name || me.email || "",
        note: String(body.note || "").slice(0, 300),
      };
      if (body.extra_listings !== undefined) patch.extra_listings = Math.max(0, Math.round(Number(body.extra_listings) || 0));
      if (body.extra_tours !== undefined) patch.extra_tours = Math.max(0, Math.round(Number(body.extra_tours) || 0));
      if (rows?.[0]) {
        await svc.entities.UserOverride.update(rows[0].id, patch);
      } else {
        await svc.entities.UserOverride.create({ user_id: userId, ...patch });
      }
      results.push(`Extra-limite: +${patch.extra_listings ?? rows?.[0]?.extra_listings ?? 0} anunțuri, +${patch.extra_tours ?? rows?.[0]?.extra_tours ?? 0} tururi 3D`);
    }

    // Credite de boost (mișcare în registru, nu override)
    const boostCredits = Math.round(Number(body.boost_credits) || 0);
    if (boostCredits > 0) {
      const balance = await addCredits(svc, {
        userId, delta: boostCredits, reason: "admin", sourceId: `admin:${me.id}`,
        note: (body.note || `Acordat de ${me.full_name || me.email}`).slice(0, 300),
      });
      results.push(`+${boostCredits} boost-uri (sold nou: ${balance})`);
    }

    if (!results.length) return Response.json({ error: "Nimic de acordat — trimite extra_listings, extra_tours sau boost_credits." });

    try {
      await svc.entities.AuditLog.create({
        actor_id: me.id, actor_name: me.full_name || me.email, actor_role: roleUp,
        action: "grant_override", target_type: "user", target_id: userId,
        detail: `${target.email || userId}: ${results.join(" · ")}`.slice(0, 300),
      });
    } catch (_) { /* best-effort */ }

    return Response.json({ ok: true, results });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) });
  }
}