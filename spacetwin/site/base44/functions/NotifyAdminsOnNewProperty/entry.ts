// #7 — Anunț nou în așteptarea moderării → email + notificare către admini.
import { client, getAdmins, sendVC, notifyMany, APP_URL } from "../../shared/email.js";

export default async function(req) {
  try {
    const base44 = await client(req);

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const title = body.title || "Anunț nou";
    const authorName = body.author_name || body.owner_name || "Un utilizator";
    const submittedDate = body.submitted_date || new Date().toISOString().slice(0, 10);
    if (!body.property_id) {
      return Response.json({ error: "property_id required" }, { status: 400 });
    }

    const admins = await getAdmins(base44);

    const subject = `⚠️ Anunț nou în așteptarea moderării — VerifiCasa`;
    const content = {
      category: "property_pending",
      title: "Anunț nou în așteptarea moderării",
      greeting: "Salut, Admin!",
      intro: "Un utilizator tocmai a publicat o proprietate nouă care necesită verificare manuală în Admin Panel.",
      dataFields: [
        { icon: "🏠", label: "Titlu", value: title },
        { icon: "👤", label: "Autor", value: authorName },
        { icon: "📅", label: "Data trimiterii", value: submittedDate },
      ],
      ctaLink: `${APP_URL}/admin`,
      ctaLabel: "Deschide Panoul de Admin",
      closingNote: "🔍 Acțiune necesară: Verificare detalii și aprobare/respingere.",
    };

    let emailed = 0;
    let notified = 0;
    for (const a of admins) {
      if (await sendVC(base44, { to: a.email, subject, content })) emailed += 1;
    }
    if (admins.length) {
      notified = await notifyMany(base44, admins.map((a) => ({
        user_id: a.id, type: "property",
        text: `Anunț nou „${title}” așteaptă aprobarea ta.`,
        link: "/admin", actor_name: authorName, read: false,
      })));
    }

    return Response.json({ ok: true, emailed, notified, admins: admins.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}