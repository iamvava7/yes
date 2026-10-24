import { base44 } from "@/api/base44Client";

// Helpers de client pentru boost-uri. Soldul se citește din registrul
// BoostCredit (RLS: fiecare își vede doar propriile rânduri); scrierile trec
// obligatoriu prin funcții de backend.

export async function fetchBoostBalance(userId) {
  if (!userId) return 0;
  try {
    const rows = await base44.entities.BoostCredit.filter({ user_id: userId }, "-created_date", 500);
    return (rows || []).reduce((sum, r) => sum + (Number(r.delta) || 0), 0);
  } catch (e) {
    // Un refuz de permisiune arăta identic cu „zero boost-uri". Soldul rămâne 0
    // ca interfața să nu crape, dar motivul real ajunge în consolă.
    console.warn("[VerifiCasa] fetchBoostBalance a eșuat:", e?.message || e);
    return 0;
  }
}

export async function fetchBoostLedger(userId, limit = 20) {
  if (!userId) return [];
  try {
    return await base44.entities.BoostCredit.filter({ user_id: userId }, "-created_date", limit);
  } catch (e) {
    return [];
  }
}

// Numărul de anunțuri active ale unui utilizator — baza contorului de limite.
export async function fetchActiveListingCount(userId) {
  if (!userId) return 0;
  try {
    const rows = await base44.entities.Property.filter(
      { created_by_id: userId, status: "Activ" }, "-created_date", 200
    );
    return (rows || []).filter((p) => p.approval_status !== "REJECTED").length;
  } catch (e) {
    return 0;
  }
}

function unwrap(res) {
  const data = res?.data || res || {};
  return { ok: !!data.ok, error: data.error || null, ...data };
}

// `count` — câte boost-uri deodată pe același anunț. Se adună, nu expiră.
export async function applyBoost(propertyId, count = 1) {
  try {
    return unwrap(await base44.functions.invoke("ApplyBoost", { property_id: propertyId, count }));
  } catch (e) {
    return { ok: false, error: "Nu am putut promova anunțul. Încearcă din nou." };
  }
}

// Cumpără UN boost direct pentru un anunț. Backendul pune property_id în
// metadata sesiunii Stripe, iar VerifyBoostCheckout aplică boost-ul singur la
// întoarcere — proprietarul apasă o dată, nu de două ori.
export async function buyBoostForProperty(propertyId) {
  try {
    const res = await base44.functions.invoke("CreateBoostCheckout", {
      pack_id: "b1",
      property_id: propertyId,
    });
    const data = res?.data || res || {};
    if (data.url) return { url: data.url };
    return { error: data.error || "Nu am putut porni plata. Încearcă din nou." };
  } catch (e) {
    return { error: "Nu am putut porni plata. Încearcă din nou." };
  }
}
