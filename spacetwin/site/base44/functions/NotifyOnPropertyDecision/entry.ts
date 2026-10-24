// #3 / #4 — Decizia admin asupra unui anunț → email + notificare către autor.
import { client, sendVC, notify, getUserById, getPropertyById, APP_URL } from "../../shared/email.js";

export default async function(req) {
  try {
    const base44 = await client(req);

    // Admin-only action: verify the caller is authenticated and has an admin role.
    const me = await base44.auth.me();
    if (!me) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    const role = (me.role || "").toUpperCase();
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const propertyId = body.property_id;
    const decision = (body.decision || "").toUpperCase();
    const reason = body.reason || "";
    if (!propertyId || (decision !== "APPROVED" && decision !== "REJECTED")) {
      return Response.json({ error: "property_id + decision (APPROVED|REJECTED) required" }, { status: 400 });
    }

    const property = await getPropertyById(base44, propertyId);
    if (!property) return Response.json({ error: "property not found" }, { status: 404 });
    const title = property.title || "Anunțul tău";
    const ownerId = property.created_by_id;
    const owner = await getUserById(base44, ownerId);

    const approvedDate = new Date().toISOString().slice(0, 10);

    let subject, content, link, linkLabel;
    if (decision === "APPROVED") {
      subject = `✅ Anunțul tău a fost aprobat — VerifiCasa`;
      content = {
        category: "property_approved",
        title: "Anunțul tău a fost aprobat",
        greeting: "Felicitări! 🥳",
        intro: "Anunțul tău a trecut de procesul de moderare și este acum activ și vizibil public pe platformă.",
        dataFields: [
          { icon: "🏠", label: "Proprietate", value: title },
          { icon: "📅", label: "Data aprobării", value: approvedDate },
          { icon: "🛡️", label: "Status", value: "Aprobat" },
        ],
        ctaLink: `${APP_URL}/property/${propertyId}`,
        ctaLabel: "Vezi anunțul live",
      };
      link = `/property/${propertyId}`;
      linkLabel = "Vezi anunțul";
    } else {
      subject = `⚠️ Actualizare status anunț — VerifiCasa`;
      content = {
        category: "property_rejected",
        title: "Anunțul necesită revizuire",
        greeting: "Salut!",
        intro: "Din păcate, anunțul tău nu a putut fi aprobat în starea actuală deoarece nu respectă toate standardele noastre de publicare sau necesită informații suplimentare.",
        dataFields: [
          { icon: "🏠", label: "Proprietate", value: title },
          { icon: "💬", label: "Motiv moderare", value: reason || "Te rugăm să adaugi fotografii clare și reale ale interiorului." },
        ],
        ctaLink: `${APP_URL}/my-properties`,
        ctaLabel: "Editează și retrimite",
        closingNote: "Poți edita oricând detaliile din panou și poți trimite anunțul din nou spre aprobare. 🔄",
      };
      link = "/my-properties";
      linkLabel = "Editează anunțul";
    }

    let emailed = false;
    let notified = false;
    if (owner && owner.email) {
      emailed = await sendVC(base44, { to: owner.email, subject, content });
      notified = await notify(base44, {
        user_id: owner.id,
        type: "property",
        text: decision === "APPROVED" ? `Anunțul „${title}” a fost aprobat. 🎉` : `Anunțul „${title}” a fost respins. Vezi motivul.`,
        link, actor_name: "Admin",
      });
    }

    return Response.json({ ok: true, decision, owner_contact: !!(owner && owner.email), emailed, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}