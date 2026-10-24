import { base44 } from "@/api/base44Client";
import { getEntitlements } from "@/lib/plans";

// Regulile turului 3D, partea de client. Trebuie să rămână identice cu
// base44/shared/tours.js — aceea e cea care contează, asta e ca omul să vadă
// motivul înainte să apese, nu după.
//
// Clientul, 22.08: turul se deblochează cu Basic, Pro sau Agent; primul tur
// abia la 3 zile DE LA PLATĂ; apoi cel mult unul la 3 zile.

export const TOUR_UNLOCK_PLANS = ["basic", "pro", "agent"];
export const TOUR_WAIT_DAYS = 3;
const TOUR_WAIT_MS = TOUR_WAIT_DAYS * 86400000;

export function daysLeft(fromIso, now = Date.now()) {
  if (!fromIso) return 0;
  const t = new Date(fromIso).getTime();
  if (!Number.isFinite(t)) return 0;
  const left = t + TOUR_WAIT_MS - now;
  return left <= 0 ? 0 : Math.ceil(left / 86400000);
}

export function tourGate({ planId, paidAt, lastTourAt, toursUsed = 0, quota = 0, isAdmin = false, now = Date.now() }) {
  const remaining = Math.max(0, quota - toursUsed);
  if (isAdmin) return { allowed: true, reason: null, daysLeft: 0, remaining };
  if (!planId || !TOUR_UNLOCK_PLANS.includes(planId)) {
    return { allowed: false, reason: "no_plan", daysLeft: 0, remaining: 0 };
  }
  const sincePaid = daysLeft(paidAt, now);
  if (sincePaid > 0) return { allowed: false, reason: "wait_after_payment", daysLeft: sincePaid, remaining };
  const sinceLast = daysLeft(lastTourAt, now);
  if (sinceLast > 0) return { allowed: false, reason: "wait_between_tours", daysLeft: sinceLast, remaining };
  if (remaining <= 0) return { allowed: false, reason: "quota", daysLeft: 0, remaining: 0 };
  return { allowed: true, reason: null, daysLeft: 0, remaining };
}

// Tot ce trebuie ca să răspunzi „poate pune un tur acum?", citit cu drepturile
// omului însuși: abonamentul propriu se vede, anunțurile proprii la fel.
export async function fetchTourStatus({ userId, excludePropertyId = null, isAdmin = false }) {
  const empty = { planId: null, quota: 0, toursUsed: 0, lastTourAt: null, paidAt: null };
  if (!userId) return { ...empty, ...tourGate({ ...empty, isAdmin }) };

  let sub = null;
  try {
    const rows = await base44.entities.Subscription.filter(
      { user_id: userId, status: "active" }, "-started_date", 1
    );
    sub = rows?.[0] || null;
  } catch (_) { /* fără abonament vizibil = fără plan */ }

  let mine = [];
  try {
    mine = await base44.entities.Property.filter({ created_by_id: userId }, "-updated_date", 200);
  } catch (_) { /* best-effort */ }

  const withTours = (mine || []).filter((p) => p.id !== excludePropertyId && p.tour_3d_url);
  const lastTourAt = withTours
    .map((p) => p.tour_3d_set_date || p.updated_date)
    .filter(Boolean)
    .sort()
    .pop() || null;

  const planId = sub?.plan_id || null;
  const quota = getEntitlements(planId).tours3d || 0;
  const facts = { planId, quota, toursUsed: withTours.length, lastTourAt, paidAt: sub?.started_date || null };
  return { ...facts, ...tourGate({ ...facts, isAdmin }) };
}

export async function setTourUrl(propertyId, url) {
  try {
    const res = await base44.functions.invoke("SetTourUrl", { property_id: propertyId, tour_3d_url: url });
    const data = res?.data || res || {};
    return { ok: !!data.ok, error: data.error || null, ...data };
  } catch (e) {
    return { ok: false, error: e?.message || "Nu am putut salva turul 3D." };
  }
}

// Textul motivului, în ambele limbi, ca să nu fie scris de două ori în UI.
export function tourReasonText(gate, en = false) {
  if (!gate || gate.allowed) return null;
  const d = gate.daysLeft;
  switch (gate.reason) {
    case "no_plan":
      return en ? "Unlocked with Basic, Pro or Agent" : "Se deblochează cu Basic, Pro sau Agent";
    case "wait_after_payment":
      return en
        ? `Available ${d} ${d === 1 ? "day" : "days"} after your plan starts`
        : `Disponibil peste ${d} ${d === 1 ? "zi" : "zile"} de la plată`;
    case "wait_between_tours":
      return en
        ? `One tour every ${TOUR_WAIT_DAYS} days — ${d} to go`
        : `Un tur la ${TOUR_WAIT_DAYS} zile — mai sunt ${d}`;
    case "quota":
      return en ? "You have used every 3D tour in your plan" : "Ai folosit toate tururile 3D din planul tău";
    default:
      return en ? "Not available right now" : "Indisponibil momentan";
  }
}
