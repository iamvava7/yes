// Anonymous-safe report submission. Guests and logged-in users both go
// through this function so the Report record is created with the service
// role (guests have no entity-write token). Stamps an audit log so the
// report shows in the per-property timeline + admin audit, and pings
// admins in-app.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAdmins, notifyMany } from "../../shared/email.js";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const { target_type, target_id, target_title, reason, details, reporter_name, reporter_email } = body;
    if (!target_id || !reason) {
      return Response.json({ error: "target_id and reason required" }, { status: 400 });
    }
    const tType = target_type === "comment" ? "comment" : "property";

    // Resolve the reporter if authenticated; otherwise it's anonymous.
    let reporter_user_id = null;
    let is_anonymous = true;
    let rName = (reporter_name || "").trim();
    let rEmail = (reporter_email || "").trim();
    try {
      const me = await base44.auth.me();
      if (me && me.id) {
        reporter_user_id = me.id;
        is_anonymous = false;
        if (!rName) rName = me.full_name || me.email || "";
        if (!rEmail) rEmail = me.email || "";
      }
    } catch (_) { /* not authenticated — anonymous report */ }

    const report = await base44.asServiceRole.entities.Report.create({
      target_type: tType,
      target_id,
      target_title: target_title || "",
      reason,
      details: (details || "").trim(),
      reporter_user_id,
      reporter_name: rName || "Anonim",
      reporter_email: rEmail || undefined,
      is_anonymous,
      status: "PENDING",
      auto_action: "none",
    });

    // Audit log — appears in the per-property timeline + admin audit tab.
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_id: reporter_user_id || "anonymous",
        actor_name: rName || "Anonim",
        actor_role: "USER",
        action: tType === "comment" ? "report_comment" : "report_property",
        target_type: tType,
        target_id,
        detail: `${reason}${details ? ` · ${String(details).slice(0, 120)}` : ""}`,
      });
    } catch (_) { /* best-effort */ }

    // In-app notification to all admins.
    try {
      const admins = await getAdmins(base44);
      const text = `Sesizare nouă (${reason}) pentru ${tType === "comment" ? "un comentariu" : "proprietate"}: ${target_title || target_id}`;
      await notifyMany(base44, admins.map((a) => ({
        user_id: a.id,
        type: "system",
        text,
        link: "/admin",
        actor_name: rName || "Anonim",
        read: false,
      })));
    } catch (_) { /* best-effort */ }

    return Response.json({ ok: true, id: report.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}