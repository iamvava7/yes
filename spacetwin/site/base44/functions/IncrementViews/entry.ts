import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Public endpoint: any visitor (authed or not) opening a property detail
    // increments its view counter. No user auth required.
    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const propertyId = body.property_id;
    if (!propertyId) {
      return Response.json({ error: "property_id required" }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const fetched = await svc.entities.Property.get(propertyId);
    const next = (fetched.views_count || 0) + 1;
    await svc.entities.Property.update(propertyId, { views_count: next });
    // Log a per-month view event (best-effort) so the Owner Dashboard can
    // chart views evolution over time. Failures here must never break the
    // counter increment.
    try {
      await svc.entities.ViewEvent.create({
        property_id: propertyId,
        property_title: fetched.title || "",
      });
    } catch (_) { /* ignore */ }
    return Response.json({ ok: true, views_count: next });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});