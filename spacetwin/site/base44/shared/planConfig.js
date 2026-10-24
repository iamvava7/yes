// Limitele de plan DINAMICE — citite din entitatea PlanConfig (editabilă din
// Admin → Planuri & Prețuri), cu fallback pe matricea statică ENTITLEMENTS.
// Orice modificare din admin se aplică instant la verificările server-side,
// fără redeploy.
import { getEntitlements } from "./entitlements.js";

export async function getPlanLimits(svc, planId) {
  const pid = planId || "none";
  const fallback = getEntitlements(pid);
  try {
    const rows = await svc.entities.PlanConfig.filter({ plan_id: pid }, "-updated_date", 1);
    const c = rows?.[0];
    if (!c) return fallback;
    const num = (v, fb) => (Number.isFinite(Number(v)) && v !== null && v !== undefined ? Number(v) : fb);
    return {
      activeListings: num(c.active_listings, fallback.activeListings),
      tours3d: num(c.tours_3d, fallback.tours3d),
      boostsIncluded: num(c.boosts_included, fallback.boostsIncluded),
      verifications: num(c.verifications, fallback.verifications),
      priorityWeight: fallback.priorityWeight,
    };
  } catch (_) {
    return fallback;
  }
}

// Extra-limite acordate manual de admin unui utilizator (UserOverride) —
// se ADUNĂ peste limitele planului, fără să schimbe planul.
export async function getUserExtras(svc, userId) {
  try {
    const rows = await svc.entities.UserOverride.filter({ user_id: userId }, "-updated_date", 1);
    const o = rows?.[0];
    return {
      extraListings: Number(o?.extra_listings) || 0,
      extraTours: Number(o?.extra_tours) || 0,
    };
  } catch (_) {
    return { extraListings: 0, extraTours: 0 };
  }
}