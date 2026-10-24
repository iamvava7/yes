import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Editor pachete de boost (Admin → Planuri & Prețuri). Pachetele NU au produse
// Stripe pre-create — CreateBoostCheckout trimite price_data inline, citind
// BoostPackConfig, deci o schimbare de aici e „live" la următorul checkout.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });
    const roleUp = (me.role || "").toUpperCase();
    const canEdit = roleUp === "SUPER_ADMIN" || me.role === "admin";
    if (!canEdit) return Response.json({ error: "Doar SUPER_ADMIN poate modifica pachetele de boost." });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const packId = body?.pack_id;
    if (!packId) return Response.json({ error: "pack_id lipsă." });

    const svc = base44.asServiceRole;
    const rows = await svc.entities.BoostPackConfig.filter({ pack_id: packId }, "-updated_date", 1);
    const existing: any = rows?.[0];

    if (body.delete === true) {
      if (!existing) return Response.json({ error: "Pachetul nu există." });
      await svc.entities.BoostPackConfig.delete(existing.id);
    } else {
      const patch: any = {};
      if (body.boosts !== undefined) patch.boosts = Math.max(1, Math.round(Number(body.boosts) || 1));
      if (body.price_ron !== undefined) patch.price_ron = Math.max(0, Number(body.price_ron) || 0);
      if (body.popular !== undefined) patch.popular = !!body.popular;
      if (body.single !== undefined) patch.single = !!body.single;
      if (body.active !== undefined) patch.active = !!body.active;
      if (body.sort_order !== undefined) patch.sort_order = Number(body.sort_order) || 0;
      if (existing) {
        await svc.entities.BoostPackConfig.update(existing.id, patch);
      } else {
        await svc.entities.BoostPackConfig.create({ pack_id: packId, boosts: 1, price_ron: 0, ...patch });
      }
    }

    try {
      await svc.entities.AuditLog.create({
        actor_id: me.id, actor_name: me.full_name || me.email, actor_role: roleUp,
        action: body.delete ? "delete_boost_pack" : "update_boost_pack",
        target_type: "boost_pack", target_id: packId,
        detail: body.delete ? "" : `${body.boosts ?? "?"} boost-uri · ${body.price_ron ?? "?"} RON`,
      });
    } catch (_) { /* best-effort */ }

    return Response.json({ ok: true, pack_id: packId });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) });
  }
}