// Regulile pentru tururile 3D, într-un singur loc.
//
// ATENȚIE (regulă de platformă): directorul shared/ e copiat în FIECARE funcție
// la deploy, deci publicarea unei singure funcții împrospătează doar copia ei.
// SetTourUrl e singura funcție care importă de aici deocamdată; dacă apare a
// doua, se deployează ÎMPREUNĂ.
//
// Ce a cerut clientul (22.08):
//   - turul 3D se deblochează cu un plan plătit (Basic, Pro sau Agent);
//   - proprietarul poate pune primul tur abia la 3 zile DE LA PLATĂ;
//   - și după aceea, cel mult un tur la 3 zile.
// Cota pe plan (câte tururi în total) era deja în entitlements.

export const TOUR_UNLOCK_PLANS = ["basic", "pro", "agent"];

// Trei zile, în milisecunde. Un singur loc de schimbat dacă se răzgândește.
export const TOUR_WAIT_DAYS = 3;
export const TOUR_WAIT_MS = TOUR_WAIT_DAYS * 86400000;

export function daysLeft(fromIso, now = Date.now()) {
  if (!fromIso) return 0;
  const t = new Date(fromIso).getTime();
  if (!Number.isFinite(t)) return 0;
  const left = t + TOUR_WAIT_MS - now;
  return left <= 0 ? 0 : Math.ceil(left / 86400000);
}

/**
 * Poate omul ăsta să pună un tur 3D acum?
 *
 * @param {object} a
 * @param {string|null} a.planId        planul activ (null = fără plan)
 * @param {string|null} a.paidAt        Subscription.started_date — momentul plății
 * @param {string|null} a.lastTourAt    când a pus ultimul tur
 * @param {number} a.toursUsed          câte tururi are deja
 * @param {number} a.quota              câte îi permite planul
 * @param {boolean} a.isAdmin           adminii trec peste tot
 * @param {number} [a.now]
 * @returns {{allowed: boolean, reason: string|null, daysLeft: number, remaining: number}}
 */
export function tourGate({ planId, paidAt, lastTourAt, toursUsed = 0, quota = 0, isAdmin = false, now = Date.now() }) {
  const remaining = Math.max(0, quota - toursUsed);
  if (isAdmin) return { allowed: true, reason: null, daysLeft: 0, remaining };

  if (!planId || !TOUR_UNLOCK_PLANS.includes(planId)) {
    return { allowed: false, reason: "no_plan", daysLeft: 0, remaining: 0 };
  }
  // 3 zile de la plată, nu de la crearea contului.
  const sincePaid = daysLeft(paidAt, now);
  if (sincePaid > 0) {
    return { allowed: false, reason: "wait_after_payment", daysLeft: sincePaid, remaining };
  }
  const sinceLast = daysLeft(lastTourAt, now);
  if (sinceLast > 0) {
    return { allowed: false, reason: "wait_between_tours", daysLeft: sinceLast, remaining };
  }
  if (remaining <= 0) {
    return { allowed: false, reason: "quota", daysLeft: 0, remaining: 0 };
  }
  return { allowed: true, reason: null, daysLeft: 0, remaining };
}
