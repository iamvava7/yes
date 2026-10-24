import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Punct unic de creare a notificărilor din client. Entitatea Notification are
// create blocat la admin (RLS) ca un utilizator să nu poată trimite notificări
// arbitrare altui utilizator (vector de phishing). Orice flux din browser
// (comentarii, mesaje, aprecieri) trece pe aici: validăm destinatarul, tipul
// și link-ul (doar căi interne), apoi scriem cu asServiceRole.
//
// Răspundem mereu 200 + câmp `error`, ca restul funcțiilor din proiect.
const ALLOWED_TYPES = new Set(["comment", "reply", "like", "message", "property", "review", "system"]);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const { user_id, type, text, link, actor_name } = body || {};

    if (!user_id || typeof user_id !== "string") return Response.json({ error: "user_id este necesar." });
    if (!text || typeof text !== "string" || text.length > 500) return Response.json({ error: "text invalid." });
    if (!ALLOWED_TYPES.has(type)) return Response.json({ error: "tip de notificare necunoscut." });
    // Doar link-uri interne — niciodată URL-uri absolute venite din client.
    const safeLink = typeof link === "string" && link.startsWith("/") && !link.startsWith("//") ? link.slice(0, 200) : "";

    await base44.asServiceRole.entities.Notification.create({
      user_id,
      type,
      text: text.slice(0, 500),
      link: safeLink,
      actor_name: (typeof actor_name === "string" ? actor_name : me.full_name || "").slice(0, 80),
      read: false,
    });

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e?.message || "Eroare la crearea notificării." });
  }
}
