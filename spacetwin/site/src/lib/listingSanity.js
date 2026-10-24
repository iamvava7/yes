// Detectarea anunțurilor implauzibile din datele demo.
//
// De ce există: în date există un anunț intitulat „test" cu 211.344 lei/lună,
// 1 cameră și 345 mp, cu o fotografie desenată — și, pentru că avea un
// trust_score de 52, purta insigna „Verificat". Un anunț absurd care se
// prezintă ca verificat distruge exact promisiunea produsului.
//
// Regula: dacă un anunț e implauzibil, NU primește insigne de verificare și
// NU își folosește propria fotografie. Nu îl ascundem — nu e treaba
// frontendului să șteargă date — dar nu îl lăsăm să mintă.
//
// Corectura definitivă e pe date: funcția de backend CleanDemoData, rulată
// din panoul de administrare. După ce rulează, acest fișier devine inert
// de la sine, pentru că niciun anunț nu mai declanșează vreo regulă.

const MAX_PRICE_RON = 15000;   // peste asta nu mai e chirie, e o eroare de tastare
const MAX_ROOMS = 8;
const MAX_SQM = 400;
const MAX_SQM_PER_ROOM = 120;  // 1 cameră / 345 mp e imposibil

/** Lista motivelor pentru care un anunț nu e credibil. Goală = anunț în regulă. */
export function listingIssues(p) {
  if (!p) return [];
  const issues = [];

  const title = String(p.title || "").trim();
  if (/^(test|testing|demo|asdf|aaa+)$/i.test(title)) issues.push("title");

  const price = Number(p.price_monthly);
  // Prețurile de vânzare sunt legitim mari — pragul se aplică doar chiriilor.
  if (p.transaction_type !== "SALE" && Number.isFinite(price) && price > MAX_PRICE_RON) {
    issues.push("price");
  }

  const rooms = Number(p.rooms);
  if (Number.isFinite(rooms) && rooms > MAX_ROOMS) issues.push("rooms");

  const sqm = Number(p.surface_sqm);
  if (Number.isFinite(sqm) && sqm > MAX_SQM) issues.push("surface");

  if (Number.isFinite(rooms) && rooms >= 1 && Number.isFinite(sqm) && sqm > 0) {
    if (sqm / rooms > MAX_SQM_PER_ROOM) issues.push("ratio");
  }

  return issues;
}

/** Scurtătura folosită de carduri, insigne și pagina de anunț. */
export function isImplausible(p) {
  return listingIssues(p).length > 0;
}
