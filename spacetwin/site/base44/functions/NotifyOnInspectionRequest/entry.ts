// #8 — Cerere nouă de inspecție / Tur 3D → email + notificare către admini.
import { client, getAdmins, sendVC, notifyMany, APP_URL } from "../../shared/email.js";

export default async function(req) {
  try {
    const base44 = await client(req);

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const request = body.request || body;
    const name = request.name || "Un solicitant";
    const phone = request.phone || "—";
    const address = request.address_or_url || "—";
    const pkg = request.package_interest || request.package_interest || "Inspecție teren & Tur 3D";
    const message = request.message || "";
    if (!request.email) {
      return Response.json({ error: "email required" }, { status: 400 });
    }

    const admins = await getAdmins(base44);

    const subject = `🛠️ Solicitare nouă de inspecție / Tur 3D`;
    const content = {
      category: "inspection",
      title: "Solicitare nouă de inspecție / Tur 3D",
      greeting: "Salut, echipă!",
      intro: "Un proprietar a solicitat o verificare fizică sau un Tur 3D pentru proprietatea sa.",
      dataFields: [
        { icon: "🏠", label: "Proprietate", value: address },
        { icon: "👤", label: "Solicitant", value: name },
        { icon: "📞", label: "Contact", value: phone },
        { icon: "📋", label: "Tip cerere", value: pkg },
        ...(message ? [{ icon: "💬", label: "Mesaj", value: message }] : []),
      ],
      ctaLink: `${APP_URL}/admin`,
      ctaLabel: "Gestionează cererea",
    };

    let emailed = 0;
    for (const a of admins) {
      if (await sendVC(base44, { to: a.email, subject, content })) emailed += 1;
    }
    const notified = await notifyMany(base44, admins.map((a) => ({
      user_id: a.id, type: "system", text: `Solicitare nouă de inspecție de la ${name} (${phone || "fără tel"}).`,
      link: "/admin", actor_name: name, read: false,
    })));

    return Response.json({ ok: true, emailed, notified, admins: admins.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}