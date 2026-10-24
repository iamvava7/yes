// Sursă unică de adevăr pentru planurile VerifiCasa (Basic/Pro/Agent) — folosită
// de pagina de upgrade, de secțiunea „Planul meu" din Account, și de logica de
// ordonare a anunțurilor pe planuri de pe homepage/căutare. Rank mai mare =
// plan mai important (folosit direct la sortare: Agent > Pro > Basic > fără plan).
// ---------------------------------------------------------------------------
// LIMITE DE CONT (entitlements)
// Sursa unică de adevăr pentru CIFRELE fiecărui plan. Textele de mai jos le
// citesc de aici, deci un număr se schimbă într-un singur loc și se mișcă
// peste tot: pagina de planuri, pagina de tur 3D, „Limitele contului”,
// verificarea de la publicare.
//
// Trebuie să rămână IDENTIC cu base44/shared/entitlements.js. Acela e cel care
// contează — verificarea din client e doar curtoazie de interfață.
// null = nelimitat.
//
// Ce e IMPUS și ce e doar AFIȘAT, în august 2026:
//   activeListings   — impus server-side (CheckListingAllowance, la publicare).
//   boostsIncluded   — acordat O SINGURĂ DATĂ, la activarea abonamentului
//                      (VerifyCheckoutSession scrie în registrul BoostCredit).
//                      NU se reacordă la reînnoire: reînnoirile Stripe nu trec
//                      prin nicio funcție a aplicației, fiindcă nu există webhook.
//   tours3d          — DOAR afișaj. Aplicația de captură 3D nu e livrată, deci
//                      nu există nimic de numărat. Când apare, contorul intră aici.
//   verifications    — DOAR afișaj. Verificarea o face manual un admin; nu
//                      există contor per cont.
//
// Fotografiile NU mai variază pe plan (decizia clientului, 23.08): oricine
// poate posta poze, limita e flat — vezi MAX_PHOTOS în propertyPayload.js,
// aceeași cifră impusă și server-side în CheckListingAllowance.
// ---------------------------------------------------------------------------
export const ENTITLEMENTS = {
  none:  { activeListings: 1,  tours3d: 0,  boostsIncluded: 0,  verifications: 1, priorityWeight: 0 },
  basic: { activeListings: 2,  tours3d: 2,  boostsIncluded: 2,  verifications: 1, priorityWeight: 1 },
  pro:   { activeListings: 3,  tours3d: 3,  boostsIncluded: 3,  verifications: 1, priorityWeight: 2 },
  agent: { activeListings: 30, tours3d: 30, boostsIncluded: 45, verifications: 1, priorityWeight: 3 },
};

export function getEntitlements(planId) {
  return ENTITLEMENTS[planId] || ENTITLEMENTS.none;
}

// Un rând de beneficiu. `soon: true` desenează eticheta „în curând” lângă text —
// se pune DOAR pe ce a marcat clientul el însuși ca nelivrat, ca pagina să nu
// promită mai mult decât există.
const F = (ro, en, soon = false) => ({ ro, en, soon });

// ---------------------------------------------------------------------------
// PLANURILE PLĂTITE
//
// `headline` sunt rândurile de deasupra liniei (cu iconițe pe /upgrade),
// `includes` cele de sub ea, după „Include gratuit” / „Tot ce e în X, plus”.
// Era un singur vector tăiat cu slice(0, 3); cifra 3 s-a rupt în clipa în care
// clientul a cerut șase rânduri de headline pe Basic.
//
// Planul gratuit NU e aici, e FREE_PLAN mai jos. Ținut separat pentru că
// PLAN_FILTER_OPTIONS, RecommendedByPlanSection și PLAN_BY_ID iterează PLANS și
// presupun toate un plan cumpărabil, cu rank nenul.
// ---------------------------------------------------------------------------
export const PLANS = [
  {
    id: "basic",
    rank: 1,
    name: "VerifiCasa Basic",
    shortName: "Basic",
    description: "Ideal pentru proprietarii care listează ocazional un imobil.",
    description_en: "For owners who list a property now and then.",
    monthly: 35,
    yearly: 336,
    iconImg: "/images/generated/plan-icon-basic-v2.png",
    badgeImg: "/images/generated/plan-badge-basic-v3.png",
    accent: "navy",
    tours3d: ENTITLEMENTS.basic.tours3d,
    boostsIncluded: ENTITLEMENTS.basic.boostsIncluded,
    headline: [
      F(ENTITLEMENTS.basic.activeListings + " x anunțuri active", ENTITLEMENTS.basic.activeListings + " x active listings"),
      F(ENTITLEMENTS.basic.tours3d + " x tururi 3D", ENTITLEMENTS.basic.tours3d + " x 3D tours", true),
      F(ENTITLEMENTS.basic.boostsIncluded + " x boost-uri", ENTITLEMENTS.basic.boostsIncluded + " x boosts"),
      F("1 verificare inclusă + badge pe anunțuri", "1 verification included + badge on listings"),
      F("Poziționare prioritară în căutare", "Priority placement in search"),
      F("Spațiu dedicat în listări", "Specific listing space"),
    ],
    includes: [
      F("Suport prin email", "Email support"),
      F("Vizibilitate în căutare", "Search visibility"),
      F("Badge „Verificat” pe anunț", "Verified badge on listing"),
    ],
  },
  {
    id: "pro",
    rank: 2,
    name: "VerifiCasa Pro",
    shortName: "Pro",
    description: "Pentru proprietari activi care vor vizibilitate maximă.",
    description_en: "For active owners who want maximum visibility.",
    monthly: 50,
    yearly: 480,
    iconImg: "/images/generated/plan-icon-pro-v2.png",
    badgeImg: "/images/generated/plan-badge-pro-v3.png",
    accent: "emerald",
    tours3d: ENTITLEMENTS.pro.tours3d,
    boostsIncluded: ENTITLEMENTS.pro.boostsIncluded,
    headline: [
      F(ENTITLEMENTS.pro.activeListings + " x anunțuri active", ENTITLEMENTS.pro.activeListings + " x active listings"),
      F(ENTITLEMENTS.pro.tours3d + " x tururi 3D", ENTITLEMENTS.pro.tours3d + " x 3D tours"),
      F(ENTITLEMENTS.pro.boostsIncluded + " x boost-uri", ENTITLEMENTS.pro.boostsIncluded + " x boosts"),
      F("Badge Pro pe anunțuri", "Pro badge on listings"),
      F("Spațiu dedicat în listări", "Specific listing space"),
    ],
    includes: [
      F("Badge „Verificat Pro”", "Verified Pro badge"),
      F("Statistici avansate ale anunțului", "Advanced listing stats"),
      F("Suport prioritar", "Priority support"),
    ],
  },
  {
    id: "agent",
    rank: 3,
    name: "VerifiCasa Agent",
    shortName: "Agent",
    description: "Pentru agenți și agenții cu portofolii extinse.",
    description_en: "For agents and agencies with larger portfolios.",
    monthly: 89.99,
    yearly: 863.9,
    iconImg: "/images/generated/plan-icon-agent-v2.png",
    badgeImg: "/images/generated/plan-badge-agent-v3.png",
    accent: "gold",
    tours3d: ENTITLEMENTS.agent.tours3d,
    boostsIncluded: ENTITLEMENTS.agent.boostsIncluded,
    headline: [
      F(ENTITLEMENTS.agent.activeListings + " x anunțuri active", ENTITLEMENTS.agent.activeListings + " x active listings"),
      F(ENTITLEMENTS.agent.tours3d + " x tururi 3D", ENTITLEMENTS.agent.tours3d + " x 3D tours"),
      F(ENTITLEMENTS.agent.boostsIncluded + " x boost-uri", ENTITLEMENTS.agent.boostsIncluded + " x boosts"),
      F("Badge Pro pe anunțuri", "Pro badge on listings"),
      F("Spațiu dedicat în listări", "Specific listing space"),
      F("Panou dedicat de agenție", "Dedicated agency panel", true),
    ],
    includes: [],
  },
];

// Planul fără abonament — ce primește oricine își face cont. Nu are preț și nu
// are buton de cumpărare: e aici ca să fie DECLARAT, nu ca să fie vândut.
export const FREE_PLAN = {
  id: "none",
  rank: 0,
  name: "VerifiCasa Free",
  shortName: "Free",
  description: "Un anunț, verificat, fără costuri.",
  description_en: "One listing, verified, at no cost.",
  monthly: 0,
  yearly: 0,
  iconImg: null,
  badgeImg: null,
  accent: "navy",
  tours3d: ENTITLEMENTS.none.tours3d,
  boostsIncluded: ENTITLEMENTS.none.boostsIncluded,
  headline: [
    F(ENTITLEMENTS.none.activeListings + " anunț activ", ENTITLEMENTS.none.activeListings + " active listing"),
    F(ENTITLEMENTS.none.verifications + " verificare", ENTITLEMENTS.none.verifications + " verification"),
  ],
  includes: [
    F("Suport prin email", "Email support"),
    F("Vizibilitate în căutare", "Search visibility"),
  ],
};

// Textul unui rând de beneficiu, în limba cerută.
export const featureText = (f, en) => (en ? f.en : f.ro);

export const PLAN_BY_ID = Object.fromEntries(PLANS.map((p) => [p.id, p]));

// ---------------------------------------------------------------------------
// PACHETE DE BOOST (client, 21.08 — prețuri provizorii, le schimbă Andrei)
// Un singur loc de editat: preț și număr de boost-uri.
//
// BOOST-URILE NU AU DURATĂ (decizia clientului, 22.08). Un boost stă pe anunț
// cât stă și anunțul. Nu mai există „până la data X", nu mai există
// „Prelungește", iar ExpireBoosts nu mai stinge nimic. Câmpurile de dată
// (Boost.ends_date, Property.boost_ends_date) rămân în schemă — ends_date e
// obligatoriu acolo — dar nu le mai citește nimeni: se scrie o dată în viitor
// și atât. Schema n-a fost atinsă, deci nu e nevoie de publish ca să meargă.
// ---------------------------------------------------------------------------

// b1 e pachetul „cumperi unul și gata": clientul a cerut explicit ca un
// proprietar să poată promova un anunț fără să fie obligat să ia un pachet.
// Se poate cumpăra direct de pe anunț (vezi CreateBoostCheckout cu property_id),
// caz în care boost-ul se aplică singur la întoarcerea din plată.
export const BOOST_PACKS = [
  { id: "b1",  boosts: 1,  priceRon: 14.99, single: true },
  { id: "b3",  boosts: 3,  priceRon: 31.99 },
  { id: "b6",  boosts: 6,  priceRon: 58.99, popular: true },
  { id: "b12", boosts: 12, priceRon: 80.99 },
];

export const SINGLE_BOOST_PACK = BOOST_PACKS.find((p) => p.single);

export const BOOST_PACK_BY_ID = Object.fromEntries(BOOST_PACKS.map((b) => [b.id, b]));

// Preț per boost — folosit pentru a arăta cinstit ce economisești la pachetele
// mari, în loc de un procent inventat.
export function boostUnitPrice(pack) {
  return pack.priceRon / pack.boosts;
}

// Plan curent al unui anunț/utilizator — 0 înseamnă „fără plan activ", ceea ce
// îl trimite mereu după Basic/Pro/Agent în orice sortare descrescătoare după rank.
export function planRank(planId) {
  return PLAN_BY_ID[planId]?.rank || 0;
}

export function getPlanMeta(planId) {
  return PLAN_BY_ID[planId] || null;
}

// Planul „efectiv” al unui anunț. Ordinea:
//   1. poster_plan_override — override manual de admin (date demo);
//   2. poster_plan — câmp denormalizat pe anunț, scris DOAR server-side
//      (VerifyCheckoutSession la plată, SyncPosterPlans la backfill). Sursa
//      principală de acum: Subscription.read e blocat la owner/admin, deci
//      browserul nu mai poate citi abonamentele altora.
//   3. planMap — fallback istoric (fetchActivePlanMap), care după blocarea
//      RLS mai întoarce cel mult abonamentul propriu; inofensiv, dar util
//      înainte de rularea SyncPosterPlans.
export function resolvePropertyPlan(property, planMap) {
  return (
    property?.poster_plan_override ||
    property?.poster_plan ||
    planMap?.get(property?.created_by_id) ||
    null
  );
}

// Comparator gata de folosit cu Array.prototype.sort — plan mai important
// întâi, apoi boost, apoi views_count descrescător. Planul postatorului decide
// rândul, boost-ul decide ordinea în interiorul rândului, vizualizările rup
// egalitatea. Boost-ul NU sare peste plan: un anunț promovat nu poate ascunde
// o potrivire mai bună dintr-o categorie superioară.
export function compareByPlanThenViews(planOf) {
  return (a, b) => {
    const rankDiff = planRank(planOf(b)) - planRank(planOf(a));
    if (rankDiff !== 0) return rankDiff;
    const boostDiff = (isBoosted(b) ? 1 : 0) - (isBoosted(a) ? 1 : 0);
    if (boostDiff !== 0) return boostDiff;
    return (b.views_count || 0) - (a.views_count || 0);
  };
}

// Un anunț e promovat dacă are flagul pus. Atât. Data de expirare nu se mai
// citește — vezi nota de la pachetele de boost.
export function isBoosted(property) {
  return !!property?.boost_active;
}

// Câte boost-uri s-au pus pe anunț. Se adună și nu expiră, deci numărul urcă.
// `boost_count` e denormalizat pe anunț; câtă vreme schema nu e publicată încă,
// câmpul lipsește și rămâne flagul, care valorează cel puțin unu.
export function boostCount(property) {
  const n = Number(property?.boost_count);
  if (Number.isFinite(n) && n > 0) return n;
  return property?.boost_active ? 1 : 0;
}

// Ordonare în interiorul unei liste deja filtrate: promovatele primele, apoi
// vizualizările. Folosit acolo unde planul nu mai e criteriu (rânduri deja
// grupate pe plan, rezultate de căutare).
export function compareByBoostThenViews(a, b) {
  // Mai multe boost-uri urcă mai sus: clientul a cerut ca un anunț să poată fi
  // promovat de câte ori vrea proprietarul, iar asta nu înseamnă nimic dacă
  // al doilea boost nu schimbă nimic în ordine.
  const boostDiff = boostCount(b) - boostCount(a);
  if (boostDiff !== 0) return boostDiff;
  return (b.views_count || 0) - (a.views_count || 0);
}

// Opțiuni gata de folosit pentru filtrul „Plan” din SearchFiltersDrawer —
// Agent primul (cel mai important), apoi Pro, apoi Basic — fiecare cu
// iconița mică de badge folosită și pe carduri, pentru recunoaștere vizuală
// instantă în filtrele de căutare/hartă.
// Filtrul avea doar planurile platite, deci majoritatea anunturilor nu se
// puteau filtra deloc: cine e pe gratis nu apare sub niciun buton. „Free" e
// ultimul, cu id-ul „none", exact cheia in care cade orice anunt fara plan
// (vezi Search.jsx si RecommendedByPlanSection).
export const PLAN_FILTER_OPTIONS = [
  ...PLANS.slice().reverse().map((p) => ({ id: p.id, label: p.shortName || p.name, icon: p.badgeImg })),
  { id: FREE_PLAN.id, label: FREE_PLAN.shortName || "Free", icon: FREE_PLAN.badgeImg || null },
];
