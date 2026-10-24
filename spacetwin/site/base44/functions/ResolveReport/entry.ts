// Admin-only: resolve or reject a report. Applies the chosen auto-action on
// the target (hide / send to PENDING / delete comment), logs an audit entry,
// and notifies the reporter in-app (+ optional email if registered).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendVC, notify } from "../../shared/email.js";

const ADMIN_ROLES = ["ADMIN", "admin", "SUPER_ADMIN", "super_admin"];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me || !ADMIN_ROLES.includes(me.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const { report_id, status, resolution_note, auto_action, send_email, resolved_date } = body;
    if (!report_id || !["RESOLVED", "REJECTED"].includes(status)) {
      return Response.json({ error: "report_id and valid status required" }, { status: 400 });
    }

    const report = await base44.asServiceRole.entities.Report.get(report_id);
    if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

    const resolvedAt = resolved_date ? new Date(resolved_date).toISOString() : new Date().toISOString();
    await base44.asServiceRole.entities.Report.update(report_id, {
      status,
      resolution_note: (resolution_note || "").trim(),
      resolved_by_id: me.id,
      resolved_by_name: me.full_name || me.email,
      resolved_date: resolvedAt,
      auto_action: auto_action || "none",
    });

    // Optional auto-action on the target listing/comment.
    let actionDetail = "";
    const action = auto_action || "none";
    if (report.target_type === "property" && action !== "none") {
      try {
        if (action === "hide") {
          await base44.asServiceRole.entities.Property.update(report.target_id, {
            approval_status: "REJECTED",
            status: "Închis",
          });
          actionDetail = "anunț retras/ascuns";
        } else if (action === "pending_review") {
          await base44.asServiceRole.entities.Property.update(report.target_id, { approval_status: "PENDING" });
          actionDetail = "anunț trimis în PENDING pentru modificări";
        }
      } catch (_) { /* best-effort */ }
    } else if (report.target_type === "comment" && action === "hide") {
      try {
        await base44.asServiceRole.entities.Comment.delete(report.target_id);
        actionDetail = "comentariu șters";
      } catch (_) { /* best-effort */ }
    }

    // Sesizările deschise scad scorul de încredere; odată rezolvată una,
    // scorul trebuie recalculat, altfel penalizarea rămâne lipită de anunț.
    if (report.target_type === "property" && report.target_id) {
      try {
        await base44.functions.invoke("ComputeTrustScore", { property_id: report.target_id });
      } catch (_) { /* best-effort */ }
    }

    // Audit log of the resolution decision.
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_id: me.id,
        actor_name: me.full_name || me.email,
        actor_role: (me.role || "").toUpperCase(),
        action: status === "RESOLVED" ? "resolve_report" : "reject_report",
        target_type: "report",
        target_id: report_id,
        detail: `Raport: ${report.reason}${actionDetail ? ` · ${actionDetail}` : ""}${resolution_note ? ` · ${String(resolution_note).slice(0, 160)}` : ""}`,
      });
    } catch (_) { /* best-effort */ }

    // Notify the reporter (in-app, if a registered user) + optional email.
    const verdict = status === "RESOLVED" ? "rezolvat" : "respins";
    if (report.reporter_user_id) {
      try {
        await notify(base44, {
          user_id: report.reporter_user_id,
          type: "system",
          text: `Raportul tău (${report.reason}) a fost ${verdict}.${resolution_note ? ` ${String(resolution_note).slice(0, 200)}` : ""}`,
          link: report.target_type === "property" ? `/property/${report.target_id}` : "",
          actor_name: me.full_name || me.email,
        });
      } catch (_) { /* best-effort */ }
    }
    if (send_email && report.reporter_email) {
      const isResolved = status === "RESOLVED";
      await sendVC(base44, {
        to: report.reporter_email,
        subject: `VerifiCasa — Raport ${verdict}`,
        content: {
          category: isResolved ? "report_resolved" : "report_rejected",
          title: isResolved ? "Raportul tău a fost rezolvat" : "Raportul tău a fost respins",
          greeting: "Salut!",
          intro: `Raportul tău (${report.reason}) a fost ${verdict} de echipa VerifiCasa.`,
          dataFields: [
            { icon: "📋", label: "Motiv raport", value: report.reason },
            ...(resolution_note ? [{ icon: "💬", label: "Mesaj", value: resolution_note }] : []),
          ],
          ctaLink: report.target_type === "property" ? `${APP_URL}/property/${report.target_id}` : `${APP_URL}`,
          ctaLabel: "Vezi pe platformă",
          closingNote: "Mulțumim că ne-ai ajutat să menținem platforma sigură. 🛡️",
        },
      });
    }

    return Response.json({ ok: true, actionDetail });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}