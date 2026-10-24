// Admin a contactat proprietarul pentru o cerere de inspecție →
// trimite e-mailul automat "Cererea ta de inspecție a fost preluată"
// către adresa solicitantului. Best-effort: SendEmail ajunge doar la
// utilizatori înregistrați; statusul + audit log-ul se actualizează oricum.
import { client, sendVC, APP_URL } from "../../shared/email.js";

export default async function(req) {
  try {
    const base44 = await client(req);

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const {
      inspection_id, name, email, address_or_url, package_interest, admin_note,
    } = body;

    if (!email) {
      return Response.json({ error: "email required" }, { status: 400 });
    }

    const pkg = package_interest || "Inspecție proprietate";
    const addr = address_or_url || "adresa indicată";
    const greeting = name && name.trim()
      ? `Salut, ${name.trim()}!`
      : "Salut!";

    const subject = "Cererea ta de inspecție a fost preluată";
    const content = {
      category: "inspection",
      title: "Cererea ta de inspecție a fost preluată",
      greeting,
      intro: `Solicitarea ta pentru "${pkg}" a proprietății de la ${addr} a fost înregistrată cu succes în platforma VerifiCasa. Echipa noastră de administrare te va contacta în cel mai scurt timp pentru stabilirea detaliilor.`,
      dataFields: [
        { icon: "🏠", label: "Proprietate", value: addr },
        { icon: "📋", label: "Pachet solicitat", value: pkg },
      ],
      closingNote: admin_note && admin_note.trim()
        ? admin_note.trim()
        : "Un membru al echipei VerifiCasa te va contacta în cel mai scurt timp posibil pentru a stabili detaliile inspecției.",
      ctaLink: `${APP_URL}/contact`,
      ctaLabel: "Contactează-ne",
    };

    const emailed = await sendVC(base44, { to: email, subject, content });

    return Response.json({ ok: true, emailed, inspection_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}