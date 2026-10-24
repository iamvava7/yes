// Limitele de cont, server-side. Trebuie să rămână identice cu ENTITLEMENTS din
// src/lib/plans.js — verificarea din client e doar curtoazie de interfață,
// aceasta e cea care contează.
//
// ATENȚIE: shared/ e copiat în fiecare funcție la deploy, deci funcțiile care
// importă de aici se deployează împreună.
//
// Matricea cerută de client pe 22.08.2026. Ce e impus de aici:
//   activeListings   — CheckListingAllowance, la publicare.
//   boostsIncluded   — VerifyCheckoutSession creditează registrul BoostCredit la
//                    activarea abonamentului.
//   tours3d, verifications — deocamdată doar afișaj (nu există contor de tururi
//                    și nici de verificări; verificarea o face manual un admin).
//
// Fotografiile NU mai variază pe plan (decizia clientului, 23.08): oricine
// poate posta poze, limita e flat 20/anunț pentru toată lumea. Vezi
// MAX_PHOTOS_PER_LISTING mai jos — impus în CheckListingAllowance, nu aici.
// Trebuie să rămână identic cu MAX_PHOTOS din src/lib/propertyPayload.js.
export const MAX_PHOTOS_PER_LISTING = 20;

export const ENTITLEMENTS = {
  none:  { activeListings: 1,  tours3d: 0,  boostsIncluded: 0,  verifications: 1, priorityWeight: 0 },
  basic: { activeListings: 2,  tours3d: 2,  boostsIncluded: 2,  verifications: 1, priorityWeight: 1 },
  pro:   { activeListings: 3,  tours3d: 3,  boostsIncluded: 3,  verifications: 1, priorityWeight: 2 },
  agent: { activeListings: 30, tours3d: 30, boostsIncluded: 45, verifications: 1, priorityWeight: 3 },
};

export function getEntitlements(planId) {
  return ENTITLEMENTS[planId] || ENTITLEMENTS.none;
}

// Planul activ al unui utilizator, citit cu rol de serviciu (Subscription are
// read blocat la owner/admin).
export async function getActivePlan(svc, userId) {
  try {
    const rows = await svc.entities.Subscription.filter(
      { user_id: userId, status: "active" }, "-started_date", 1
    );
    return rows?.[0]?.plan_id || null;
  } catch (_) {
    return null;
  }
}

// Câte anunțuri active are deja utilizatorul, excluzând opțional unul anume
// (cel pe care tocmai îl editează).
export async function countActiveListings(svc, userId, excludeId) {
  try {
    const rows = await svc.entities.Property.filter(
      { created_by_id: userId, status: "Activ" }, "-created_date", 200
    );
    return (rows || []).filter(
      (p) => p.id !== excludeId && p.approval_status !== "REJECTED"
    ).length;
  } catch (_) {
    return 0;
  }
}

// Pune sau scoate poster_plan de pe TOATE anunțurile unui utilizator —
// versiunea „un singur user” a SyncPosterPlans (folosită de VerifyCheckoutSession,
// StripeWebhook și AdminGrantPlan, ca să nu se aștepte după o baleiere a
// TUTUROR anunțurilor la fiecare eveniment). planId = null șterge badge-ul.
export async function stampPosterPlan(svc, userId, planId) {
  try {
    const mine = await svc.entities.Property.filter({ created_by_id: userId }, "-created_date", 200);
    const updates = (mine || [])
      .filter((p) => (p.poster_plan || null) !== planId)
      .map((p) => ({ id: p.id, poster_plan: planId }));
    if (!updates.length) return;
    try {
      await svc.entities.Property.bulkUpdate(updates);
    } catch (_) {
      for (const u of updates) {
        try { await svc.entities.Property.update(u.id, { poster_plan: u.poster_plan }); } catch (_) { /* best-effort */ }
      }
    }
  } catch (_) { /* best-effort */ }
}
