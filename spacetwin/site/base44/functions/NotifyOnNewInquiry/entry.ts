// #5 — Cerere nouă de închiriere → email + notificare către proprietarul
// anunțului (dacă e utilizator înregistrat) și către admini.
import { client, getAdmins, sendVC, notify, notifyMany, getUserById, getPropertyById, APP_URL } from "../../shared/email.js";

export default async function(req) {
  try {
    const base44 = await client(req);

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const inquiry = body.inquiry || {};
    const propertyId = inquiry.property_id || body.property_id;
    const propertyTitle = inquiry.property_title || body.property_title || "Proprietate";
    const name = inquiry.name || body.name || "Un chiriaș";
    const email = inquiry.email || body.email || "—";
    const phone = inquiry.phone || body.phone || "—";
    const occupation = inquiry.occupation || body.occupation || "—";
    const income = inquiry.estimated_income || body.estimated_income;
    const moveDate = inquiry.move_date || body.move_date || "—";
    const visitDate = inquiry.preferred_visit_date || body.preferred_visit_date || "—";
    const message = inquiry.message || body.message || "—";
    if (!propertyId) {
      return Response.json({ error: "property_id required" }, { status: 400 });
    }

    // Resolve the property owner (registered user) for in-app notification.
    const property = await getPropertyById(base44, propertyId);
    const ownerId = (property && property.created_by_id) || body.owner_id || null;
    const owner = await getUserById(base44, ownerId);

    const subject = `🔔 Cerere nouă de închiriere — ${propertyTitle}`;
    const content = {
      category: "inquiry",
      title: "Cerere nouă de închiriere",
      greeting: "Salut!",
      intro: "Ai primit o cerere nouă de la un chiriaș pentru o proprietate listată pe platformă.",
      dataFields: [
        { icon: "🏠", label: "Proprietate", value: propertyTitle },
        { icon: "👤", label: "Nume", value: name },
        { icon: "📧", label: "Email", value: email },
        { icon: "📞", label: "Telefon", value: phone },
        { icon: "💼", label: "Ocupație", value: occupation },
        ...(income ? [{ icon: "💰", label: "Venit estimat lunar", value: `${income} RON` }] : []),
        { icon: "📅", label: "Data mutării", value: moveDate },
        { icon: "👁️", label: "Data vizionării preferată", value: visitDate },
        { icon: "💬", label: "Mesaj", value: message },
      ],
      ctaLink: `${APP_URL}/my-properties`,
      ctaLabel: "Vezi și gestionează cererea",
    };

    let emailed = 0;
    let notified = 0;

    if (owner && owner.email) {
      if (await sendVC(base44, { to: owner.email, subject, content })) emailed += 1;
      if (await notify(base44, { user_id: owner.id, type: "message", text: `Cerere nouă de la ${name} pentru „${propertyTitle}".`, link: "/my-properties", actor_name: name })) notified += 1;
    }

    // Always notify admins too (they manage the platform and the inquiry).
    const admins = await getAdmins(base44);
    for (const a of admins) {
      if (await sendVC(base44, { to: a.email, subject, content })) emailed += 1;
    }
    notified += await notifyMany(base44, admins.map((a) => ({
      user_id: a.id, type: "message", text: `Cerere nouă de la ${name} pentru „${propertyTitle}".`, link: "/admin", actor_name: name, read: false,
    })));

    return Response.json({ ok: true, emailed, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}