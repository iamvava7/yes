import { base44 } from "@/api/base44Client";

// O singură interogare pentru TOATE abonamentele active, transformată într-un
// Map user_id -> plan_id. Se folosește pentru a colora/sorta zeci de anunțuri
// deodată (homepage, căutare) fără un query separat per anunț.
export async function fetchActivePlanMap() {
  const map = new Map();
  try {
    const subs = await base44.entities.Subscription.filter({ status: "active" }, "-started_date", 500);
    for (const s of subs) {
      if (!s.user_id || !s.plan_id) continue;
      // Dacă din orice motiv există mai multe rânduri active pentru același
      // user, păstrează doar cel mai recent (primul întâlnit, dat fiind sortul).
      if (!map.has(s.user_id)) map.set(s.user_id, s.plan_id);
    }
  } catch (e) {
    // best-effort — o eroare aici nu trebuie să blocheze afișarea anunțurilor,
    // doar înseamnă că toate vor cădea în categoria „fără plan”.
  }
  return map;
}

// Abonamentul activ curent al unui singur utilizator (folosit pe Account —
// secțiunea „Planul meu”).
export async function fetchMyActiveSubscription(userId) {
  if (!userId) return null;
  try {
    const rows = await base44.entities.Subscription.filter({ user_id: userId, status: "active" }, "-started_date", 1);
    return rows[0] || null;
  } catch (e) {
    return null;
  }
}
