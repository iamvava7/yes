import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Returns monthly view + inquiry aggregates (last 6 months) for every
// property owned by `owner_id`. Backs the Owner Dashboard charts.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const ownerId = body.owner_id;
    if (!ownerId) {
      return Response.json({ error: "owner_id required" }, { status: 400 });
    }

    // Authenticate the caller and authorize: only the owner themselves or an
    // admin may read this owner's analytics (prevents IDOR via arbitrary owner_id).
    const me = await base44.auth.me();
    if (!me) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    const isAdmin = (me.role || "").toUpperCase() === "ADMIN" || (me.role || "").toUpperCase() === "SUPER_ADMIN";
    if (me.id !== ownerId && !isAdmin) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Owner's properties (guarded by created_by_id equality).
    const props = await svc.entities.Property.filter(
      { created_by_id: ownerId },
      "-created_date",
      200
    );

    // Last 6 months as "YYYY-MM" buckets (oldest -> newest).
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const views: Record<string, number[]> = {};
    const inqs: Record<string, number[]> = {};
    for (const p of props) {
      views[p.id] = new Array(6).fill(0);
      inqs[p.id] = new Array(6).fill(0);

      try {
        const events = await svc.entities.ViewEvent.filter(
          { property_id: p.id },
          "-created_date",
          1000
        );
        for (const ev of events) {
          const m = (ev.created_date || "").slice(0, 7);
          const idx = months.indexOf(m);
          if (idx >= 0) views[p.id][idx] += 1;
        }
      } catch (_) { /* ViewEvent may be empty/missing — ignore */ }

      try {
        const inquiries = await svc.entities.Inquiry.filter(
          { property_id: p.id },
          "-created_date",
          1000
        );
        for (const iq of inquiries) {
          const m = (iq.created_date || "").slice(0, 7);
          const idx = months.indexOf(m);
          if (idx >= 0) inqs[p.id][idx] += 1;
        }
      } catch (_) { /* ignore */ }
    }

    return Response.json({
      months,
      properties: props.map((p) => ({ id: p.id, title: p.title || "Fără titlu" })),
      views,
      inquiries: inqs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});