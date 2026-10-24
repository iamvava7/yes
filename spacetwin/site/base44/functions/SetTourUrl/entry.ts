import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getEntitlements } from "../../shared/entitlements.js";
import { tourGate } from "../../shared/tours.js";

// Pune (sau șterge) link-ul turului 3D pe un anunț.
//
// Nu se scrie direct din formular pentru că regulile nu pot fi exprimate în
// RLS: „la 3 zile după plată" și „cel mult un tur la 3 zile" cer să știi când
// a plătit omul și când a pus ultimul tur. Aici se verifică, apoi se scrie cu
// rol de serviciu.
//
// Cine are voie: proprietarul anunțului, pe un plan plătit, dacă a trecut de
// ambele ferestre de 3 zile și mai are cotă. Adminii trec peste tot.
const ADMIN_ROLES = new Set(["admin", "ADMIN", "SUPER_ADMIN", "super_admin"]);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const propertyId = body?.property_id;
    const url = String(body?.tour_3d_url || "").trim();
    if (!propertyId) return Response.json({ error: "property_id este necesar." });

    const svc = base44.asServiceRole;
    const p: any = await svc.entities.Property.get(propertyId);
    if (!p) return Response.json({ error: "Anunțul nu a fost găsit." });

    const isAdmin = ADMIN_ROLES.has(String(me.role || ""));
    if (p.created_by_id !== me.id && !isAdmin) {
      return Response.json({ error: "Poți edita doar anunțurile tale." });
    }

    // Ștergerea nu e limitată de nimic: dacă vrei turul jos, se duce jos, iar
    // cota se eliberează (un tur = un anunț care are link, vezi mai jos).
    // DATA rămâne pe anunț: ea ține blocajul de 30 de zile de mai jos, altfel
    // șterge-și-pune ocolea regula într-un minut.
    if (!url) {
      await svc.entities.Property.update(propertyId, { tour_3d_url: "" });
      return Response.json({ ok: true, cleared: true });
    }

    if (!/^https?:\/\//i.test(url)) {
      return Response.json({ error: "Link-ul trebuie să înceapă cu http:// sau https://" });
    }

    // Clientul, 23.08: link-ul turului se poate SCHIMBA o dată la 30 de zile
    // pe același anunț. Primul link e liber; retrimiterea aceluiași link e
    // no-op permis; adminii trec peste.
    const CHANGE_LOCK_DAYS = 30;
    if (!isAdmin && p.tour_3d_set_date && url !== p.tour_3d_url) {
      const since = Date.now() - new Date(p.tour_3d_set_date).getTime();
      const lockMs = CHANGE_LOCK_DAYS * 86400000;
      if (Number.isFinite(since) && since >= 0 && since < lockMs) {
        const days = Math.ceil((lockMs - since) / 86400000);
        return Response.json({
          error: `Link-ul turului 3D se poate schimba o dată la ${CHANGE_LOCK_DAYS} de zile. Mai ${days === 1 ? "e o zi" : `sunt ${days} zile`}.`,
          reason: "change_lock",
          daysLeft: days,
        });
      }
    }
    if (url === p.tour_3d_url) {
      return Response.json({ ok: true, unchanged: true });
    }

    // Planul și momentul plății.
    const subs = await svc.entities.Subscription.filter(
      { user_id: p.created_by_id, status: "active" }, "-started_date", 1
    );
    const sub = subs?.[0] || null;
    const planId = sub?.plan_id || null;
    const quota = getEntitlements(planId).tours3d || 0;

    // Un tur folosit = un anunț al lui care are link. Se eliberează singur
    // când anunțul dispare sau când link-ul e șters — decizia clientului.
    const mine = await svc.entities.Property.filter({ created_by_id: p.created_by_id }, "-updated_date", 200);
    const withTours = (mine || []).filter((x: any) => x.id !== propertyId && x.tour_3d_url);
    const toursUsed = withTours.length;
    const lastTourAt = withTours
      .map((x: any) => x.tour_3d_set_date || x.updated_date)
      .filter(Boolean)
      .sort()
      .pop() || null;

    const gate = tourGate({
      planId,
      paidAt: sub?.started_date || null,
      lastTourAt,
      toursUsed,
      quota,
      isAdmin,
    });

    if (!gate.allowed) {
      const msg: Record<string, string> = {
        no_plan: "Turul 3D se deblochează cu un plan Basic, Pro sau Agent.",
        wait_after_payment: `Mai sunt ${gate.daysLeft} zile până poți publica primul tur 3D.`,
        wait_between_tours: `Poți publica un tur 3D la 3 zile. Mai sunt ${gate.daysLeft} zile.`,
        quota: "Ai folosit toate tururile 3D din planul tău.",
      };
      return Response.json({ error: msg[gate.reason || ""] || "Turul 3D nu e disponibil acum.", ...gate });
    }

    await svc.entities.Property.update(propertyId, {
      tour_3d_url: url,
      tour_3d_set_date: new Date().toISOString(),
    });

    const remainingAfter = Math.max(0, gate.remaining - 1);

    // Notificare in-app la epuizare (cererea clientului, 23.08): la 1 sau la
    // 0 tururi rămase din cotă, după ce tocmai s-a folosit unul.
    if (!isAdmin && remainingAfter <= 1) {
      try {
        await svc.entities.Notification.create({
          user_id: p.created_by_id,
          type: "system",
          text: remainingAfter === 0
            ? "Ai folosit toate tururile 3D din planul tău."
            : "Ți-a mai rămas un singur tur 3D din planul tău.",
          link: "/upgrade",
          actor_name: "VerifiCasa",
          read: false,
        });
      } catch (_) { /* best-effort */ }
    }

    return Response.json({ ok: true, remaining: remainingAfter });
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) });
  }
}
