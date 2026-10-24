import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { BOOST_WARNING_DAYS_BEFORE } from "../../shared/boosts.js";

// Fiecare grup de boost-uri aplicat (un rând din entitatea Boost) are
// PROPRIUL lui ceas de 21 de zile, independent de celelalte (decizia
// clientului, 23.08). Dacă cineva bagă 2 boost-uri azi și 13 mâine, sunt
// DOUĂ grupuri, cu date de expirare diferite — nu se contopesc într-un
// singur cronometru pe anunț.
//
// Funcția asta trece prin toate rândurile Boost cu status="active":
//   1. Avertisment — dacă mai sunt ≤ BOOST_WARNING_DAYS_BEFORE zile și acel
//      GRUP încă n-a fost avertizat (Boost.warned), trimite avertismentul.
//   2. Expirare — dacă ends_date a trecut, marchează grupul "expired" și
//      SCADE boost_count de pe anunț cu exact credits_spent din acel grup.
//      boost_active pe anunț devine false doar când NU mai există niciun
//      grup activ pentru acel anunț.
//
// De rulat pe program (Base44 → Workflows → Scheduled → Recurring, o dată pe
// zi) sau manual dintr-un buton de Admin. Idempotent: un grup deja "expired"
// sau deja "warned" nu se retrimite/re-scade la rulările următoare.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const now = new Date();
    const warnCutoff = new Date(now.getTime() + BOOST_WARNING_DAYS_BEFORE * 24 * 60 * 60 * 1000);

    const activeBoosts: any[] = await svc.entities.Boost.filter({ status: "active" }, "-created_date", 1000);

    let warned = 0;
    let expiredGroups = 0;
    // property_id -> câte credite s-au scăzut din grupurile expirate acum,
    // ca să facem UN singur update pe Property (nu unul per grup).
    const creditsToRemove = new Map<string, number>();
    const touchedProperties = new Set<string>();

    for (const b of activeBoosts) {
      if (!b.ends_date || !b.property_id) continue;
      const endsAt = new Date(b.ends_date);
      touchedProperties.add(b.property_id);

      if (endsAt <= now) {
        try {
          await svc.entities.Boost.update(b.id, { status: "expired" });
          const spent = Number(b.credits_spent) || 0;
          creditsToRemove.set(b.property_id, (creditsToRemove.get(b.property_id) || 0) + spent);
          expiredGroups += 1;
        } catch (_) { /* best-effort — trecem la urm\u0103torul grup */ }
        continue;
      }

      if (endsAt <= warnCutoff && !b.warned) {
        try {
          const daysLeft = Math.max(1, Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
          await svc.entities.Boost.update(b.id, { warned: true });
          const p: any = await svc.entities.Property.get(b.property_id).catch(() => null);
          await svc.entities.Notification.create({
            user_id: b.user_id,
            type: "system",
            text: `${b.credits_spent || 1} boost${(b.credits_spent || 1) === 1 ? "" : "-uri"} pentru „${(p && p.title) || "un anunț"}” expiră în ${daysLeft} ${daysLeft === 1 ? "zi" : "zile"}.`,
            link: "/my-properties",
            actor_name: "VerifiCasa",
            read: false,
          });
          warned += 1;
        } catch (_) { /* best-effort — trecem la urm\u0103torul grup */ }
      }
    }

    // Aplicăm scăderea de boost_count o singură dată per anunț atins, apoi
    // verificăm dacă mai rămâne vreun grup activ ca să decidem boost_active.
    let propertiesExpired = 0;
    for (const propertyId of creditsToRemove.keys()) {
      try {
        const p: any = await svc.entities.Property.get(propertyId);
        const removed = creditsToRemove.get(propertyId) || 0;
        const nextCount = Math.max(0, (Number(p.boost_count) || 0) - removed);

        const stillActive = await svc.entities.Boost.filter(
          { property_id: propertyId, status: "active" }, "-created_date", 1
        );
        const nowBoosted = stillActive.length > 0;

        await svc.entities.Property.update(propertyId, {
          boost_count: nextCount,
          boost_active: nowBoosted,
        });

        if (!nowBoosted) {
          propertiesExpired += 1;
          await svc.entities.Notification.create({
            user_id: p.created_by_id,
            type: "system",
            text: `Promovarea pentru „${p.title || "anunțul tău"}” a expirat.`,
            link: "/my-properties",
            actor_name: "VerifiCasa",
            read: false,
          }).catch(() => {});
        }
      } catch (_) { /* best-effort — trecem la urm\u0103torul anun\u021b */ }
    }

    return Response.json({
      ok: true,
      checked: activeBoosts.length,
      touched_properties: touchedProperties.size,
      warned,
      expired_groups: expiredGroups,
      properties_fully_expired: propertiesExpired,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) });
  }
}
