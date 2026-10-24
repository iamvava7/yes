import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getBalance, addCredits, boostEndsAt } from "../../shared/boosts.js";

// Consumă un credit și promovează un anunț. Verifică server-side că anunțul
// chiar aparține celui care cere: boost-ul se scrie cu asServiceRole, deci
// RLS-ul de pe Property nu ne mai apără aici.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Trebuie să fii autentificat." });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const propertyId = body?.property_id;
    if (!propertyId) return Response.json({ error: "property_id este necesar." });
    // Câte boost-uri deodată. Un anunț poate primi oricâte — fiecare îl urcă
    // mai sus și niciunul nu expiră.
    const want = Math.max(1, Math.min(50, Math.floor(Number(body?.count) || 1)));

    const svc = base44.asServiceRole;
    const p: any = await svc.entities.Property.get(propertyId);
    if (!p) return Response.json({ error: "Anunțul nu a fost găsit." });

    const role = String(me.role || "").toUpperCase();
    const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
    if (p.created_by_id !== me.id && !isAdmin) {
      return Response.json({ error: "Poți promova doar anunțurile tale." });
    }
    // Clientul, 23.08: boost-urile se aleg pe ultimul pas al publicării, când
    // anunțul e încă „în așteptare". Un anunț PENDING al propriului autor se
    // poate promova de pe acum — boost-ul stă pe anunț și contează public din
    // clipa aprobării; cum boost-urile nu expiră, nimic nu se pierde. Singurul
    // refuz rămâne anunțul respins.
    if (p.approval_status === "REJECTED") {
      return Response.json({ error: "Un anunț respins nu poate fi promovat." });
    }

    const balance = await getBalance(svc, me.id);
    if (balance < want) {
      return Response.json({
        error: want === 1 ? "Nu ai boost-uri disponibile." : `Ai doar ${balance} boost-uri disponibile.`,
        balance,
      });
    }

    // Boost-urile se adună pe același anunț, dar FIECARE grup aplicat are
    // propriul lui ceas de 21 de zile, independent de celelalte (decizia
    // clientului, 23.08). Grupul asta primește starts_date/ends_date proprii
    // în rândul Boost de mai jos; nu se atinge nimic din grupurile anterioare.
    const now = Date.now();
    const endsDate = boostEndsAt(now);
    const nextCount = (Number(p.boost_count) || 0) + want;

    // ORDINEA CONTEAZĂ. Înainte, anunțul se promova întâi și creditul se scădea
    // după — fără tranzacție și fără revenire. Dacă scăderea eșua (registrul
    // BoostCredit are `create` doar pentru admin și trece prin asServiceRole),
    // anunțul rămânea promovat pe gratis și în registru nu apărea nimic.
    //
    // Acum creditul se REZERVĂ întâi. Dacă aplicarea eșuează după aceea, îl dăm
    // înapoi cu un rând de „refund", ca soldul să nu se piardă în tăcere.
    const after = await addCredits(svc, {
      userId: me.id, delta: -want, reason: "spend", sourceId: propertyId, note: p.title || "",
    });

    try {
      await svc.entities.Boost.create({
        property_id: propertyId,
        user_id: me.id,
        starts_date: new Date(now).toISOString(),
        ends_date: endsDate,
        status: "active",
        credits_spent: want,
      });

      // Câmpuri denormalizate: sortarea și ștampila „Promovat" le citesc direct
      // de pe anunț, fără un query separat per card.
      await svc.entities.Property.update(propertyId, {
        boost_active: true,
        boost_ends_date: endsDate,
        boost_count: nextCount,
      });
    } catch (applyErr: any) {
      const restored = await addCredits(svc, {
        userId: me.id, delta: want, reason: "refund", sourceId: propertyId,
        note: "Promovare eșuată — credit returnat",
      }).catch(() => null);
      return Response.json({
        error: applyErr?.message || "Promovarea nu a putut fi aplicată. Creditul a rămas în cont.",
        balance: restored ?? after + 1,
      });
    }

    return Response.json({ ok: true, balance: after, boost_count: nextCount });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Eroare la promovare." });
  }
}
