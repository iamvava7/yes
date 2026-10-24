import { useCountry } from "@/components/CountryContext";

// Textele formularului de publicare, RO + EN.
//
// Formularul era complet în română, oricât ai fi comutat limba: PropertyWizard
// citea `lang` într-un singur loc din ~700 de rânduri, iar cei șase pași nu îl
// citeau deloc. Comutatorul din antetul paginii schimba restul aplicației și
// lăsa exact ecranul în care omul trebuie să scrie cel mai mult.
//
// Stă aici, nu în src/i18n.js: sunt ~90 de șiruri folosite de un singur flux,
// aceeași alegere ca la About.jsx și Tur3D.jsx.
//
// ATENȚIE la ce NU se traduce: valorile SALVATE în entitate rămân în română,
// pentru că sunt date, nu interfață — tipul proprietății („Garsonieră"), rolul
// („Proprietar"/„Agent") și etichetele din FACILITY_OPTS, care se scriu în
// `features`. Traducerea lor ar rupe filtrele de căutare și ar umple baza cu
// două grafii pentru același lucru. Pentru ele există etichete de AFIȘARE
// separate (vezi `label_en` în lib/propertyPayload.js și PROPERTY_TYPE_EN mai jos).

export const WIZ = {
  ro: {
    // pagina
    page_h: "Publică-ți proprietatea",
    page_sub: "Durează ~3 minute. Te ghidăm pas cu pas.",
    back_to_site: "Înapoi la site",

    // pași
    steps: [
      { title: "Ce publici", sub: "Tipul anunțului și titlul" },
      { title: "Locație", sub: "Unde se află proprietatea" },
      { title: "Detalii", sub: "Preț, spațiu, descriere" },
      { title: "Facilități", sub: "Ce oferă locuința" },
      { title: "Poze & contact", sub: "Ultimul pas" },
    ],
    step_of: (n, m) => `Pasul ${n} din ${m}`,

    // navigare
    cancel: "Renunță",
    back: "Înapoi",
    next: "Continuă",
    publish: "Publică anunțul",
    publishing: "Se publică…",
    published: "Publicat!",
    retry: "Încearcă din nou",

    // validări
    err_title: "Adaugă un titlu pentru anunț.",
    err_city: "Alege orașul.",
    err_price: "Completează prețul.",
    err_surface: "Completează suprafața.",
    err_year: "Completează anul construcției.",
    err_available: "Alege data de la care e disponibilă.",
    err_desc: "Adaugă o descriere.",
    err_features: (n) => `Bifează cel puțin ${n} dotări sau facilități.`,
    err_photos: (n) => `Încarcă cel puțin ${n} poze`,
    err_phone: "Completează numărul de telefon",
    err_terms: "Acceptă termenii pentru a publica",
    err_max_photos: (n) => `Ai atins maximul de ${n} poze`,
    err_upload: "Încărcarea pozelor a eșuat",
    err_limit_t: "Ai atins limita planului",
    err_limit_d: "Treci pe un plan superior ca să publici mai multe anunțuri.",

    ok_admin_t: "Anunț publicat",
    ok_admin_d: "Este vizibil acum în lista publică.",
    ok_t: "Anunț trimis spre aprobare",
    ok_d: "Un administrator îl va verifica în curând.",
    real_photos: "Poze reale, făcute cu telefonul. Fără randări.",

    // pasul 1
    b_intent: "Ce vrei să faci?",
    b_rent: "Închiriere",
    b_rent_sub: "Chirie lunară",
    b_sale: "Vânzare",
    b_sale_sub: "Preț total",
    b_type: "Tip proprietate",
    b_title: "Titlul anunțului",
    b_title_hint: "Ex: Apartament 2 camere modern, Copou — renovat 2023",
    b_title_ph: "Scrie un titlu scurt și clar",

    // pasul 2
    l_city: "Oraș și zonă",
    l_city_ph: "Scrie orașul (ex: Cluj-Napoca)",
    l_map: "Locație exactă pe hartă",
    l_map_ph: "Caută adresa (ex: Strada Nicolae Iorga, Iași)…",
    l_map_hint: "Selectează adresa din sugestii — coordonatele GPS se salvează automat.",

    // pasul 3
    d_price_sale: "Preț (EUR)",
    d_price_rent: "Chirie / lună (EUR)",
    d_deposit: "Depozit / Garanție (EUR)",
    d_rooms: "Camere",
    d_surface: "Suprafață (mp)",
    d_floor: "Etaj",
    d_floor_hint: "Ex: 3, Parter, Demisol",
    d_total_floors: "Total etaje clădire",
    d_year: "An construcție",
    d_available: "Disponibil din",
    d_desc: "Descriere",
    d_desc_hint: "Spune ce face locul special — lumină, vecinătate, renovări recente.",
    d_desc_ph: "Descrie proprietatea…",

    // pasul 4
    f_verified: "Facilități verificate",
    f_verified_note: "Apar evidențiate în pagina anunțului.",
    f_picked: (c, n) => `Bifate: ${c} din minim ${n}`,
    f_picked_ok: "Gata, poți continua.",
    f_amenities: "Dotări",
    f_options: "Opțiuni",
    f_options_note: "Apar automat în filtrele de căutare.",

    // pasul 5
    p_uploading: "Se încarcă…",
    p_upload: "Încarcă pozele",
    p_limits: (min, max) => `Minim ${min}, maxim ${max} · JPG / PNG`,
    p_cover: "Copertă",
    p_count: (n, min) => `${n} / ${min} poze minime`,
    p_remove: "Șterge poza",
    p_tour_t: "Tur 3D (opțional)",
    p_tour_d: "Îl faci cu aplicația noastră, din telefon · Plan Pro",
    p_tour_how: "Cum funcționează",
    p_tour_open: "Deschide aplicația 3D",
    p_tour_soon: "Aplicația de tur 3D — în curând",
    p_boost_t: "Promovează anunțul",
    p_boost_have: (n) => `ai ${n} boost${n === 1 ? "" : "-uri"}`,
    p_boost_none: "nu ai boost-uri",
    p_boost_buy: "Cumpără boost-uri",
    p_boost_more: "cumpără mai multe",
    p_boost_note: "Se aplică la publicare; anunțul urcă în listă imediat ce e aprobat.",
    p_boost_fail: "Anunțul e publicat, dar promovarea nu s-a aplicat — boost-urile au rămas în cont.",
    p_plan_t: "Planul tău",
    p_plan_none: "Fără plan",
    p_plan_see: "vezi planurile",
    p_tours_t: "Tururi 3D",
    p_tours_have: (r, q) => `${r} din ${q} disponibile`,
    p_tour_link_l: "Link tur 3D (opțional)",
    p_tour_link_note: "Se salvează la publicare. Link-ul se poate schimba o dată la 30 de zile.",
    p_tour_fail: "Anunțul e publicat, dar turul 3D nu s-a salvat — îl poți adăuga din anunțul tău.",
    p_phone: "Telefon",
    p_whatsapp: "WhatsApp",
    p_whatsapp_hint: "Format internațional, ex: 40759...",
    p_name: "Nume afișat",
    p_name_hint: "Preluat automat din contul tău",
    p_name_ph: "Nume proprietar",
    p_role: "Postez ca",
    p_terms_pre: "Sunt de acord cu ",
    p_terms: "Termenii",
    p_and: " și ",
    p_privacy: "Politica de confidențialitate",
    p_terms_note: "Se deschid într-o pagină nouă — nu pierzi ce ai scris.",
  },

  en: {
    page_h: "List your property",
    page_sub: "Takes about 3 minutes. We walk you through it.",
    back_to_site: "Back to site",

    steps: [
      { title: "What you're listing", sub: "Listing type and title" },
      { title: "Location", sub: "Where the property is" },
      { title: "Details", sub: "Price, space, description" },
      { title: "Features", sub: "What the place offers" },
      { title: "Photos & contact", sub: "Last step" },
    ],
    step_of: (n, m) => `Step ${n} of ${m}`,

    cancel: "Cancel",
    back: "Back",
    next: "Continue",
    publish: "Publish listing",
    publishing: "Publishing…",
    published: "Published!",
    retry: "Try again",

    err_title: "Add a title for the listing.",
    err_city: "Choose the city.",
    err_price: "Fill in the price.",
    err_surface: "Fill in the surface area.",
    err_year: "Fill in the year it was built.",
    err_available: "Pick the date it becomes available.",
    err_desc: "Add a description.",
    err_features: (n) => `Tick at least ${n} features or amenities.`,
    err_photos: (n) => `Upload at least ${n} photos`,
    err_phone: "Fill in your phone number",
    err_terms: "Accept the terms to publish",
    err_max_photos: (n) => `You have reached the maximum of ${n} photos`,
    err_upload: "The photo upload failed",
    err_limit_t: "You have reached your plan's limit",
    err_limit_d: "Move to a higher plan to publish more listings.",

    ok_admin_t: "Listing published",
    ok_admin_d: "It is visible in the public list now.",
    ok_t: "Listing sent for approval",
    ok_d: "An administrator will check it shortly.",
    real_photos: "Real photos, taken on your phone. No renders.",

    b_intent: "What do you want to do?",
    b_rent: "Rent out",
    b_rent_sub: "Monthly rent",
    b_sale: "Sell",
    b_sale_sub: "Total price",
    b_type: "Property type",
    b_title: "Listing title",
    b_title_hint: "e.g. Modern 2-room flat, Copou — renovated 2023",
    b_title_ph: "Write a short, clear title",

    l_city: "City and area",
    l_city_ph: "Type the city (e.g. Cluj-Napoca)",
    l_map: "Exact location on the map",
    l_map_ph: "Search the address (e.g. Strada Nicolae Iorga, Iași)…",
    l_map_hint: "Pick the address from the suggestions — GPS coordinates save automatically.",

    d_price_sale: "Price (EUR)",
    d_price_rent: "Rent / month (EUR)",
    d_deposit: "Deposit (EUR)",
    d_rooms: "Rooms",
    d_surface: "Surface (sqm)",
    d_floor: "Floor",
    d_floor_hint: "e.g. 3, Ground, Basement",
    d_total_floors: "Floors in the building",
    d_year: "Year built",
    d_available: "Available from",
    d_desc: "Description",
    d_desc_hint: "Say what makes the place special — light, the neighbourhood, recent work.",
    d_desc_ph: "Describe the property…",

    f_verified: "Verified features",
    f_verified_note: "These are highlighted on the listing page.",
    f_picked: (c, n) => `Ticked: ${c} of at least ${n}`,
    f_picked_ok: "Done, you can continue.",
    f_amenities: "Amenities",
    f_options: "Options",
    f_options_note: "These appear automatically in search filters.",

    p_uploading: "Uploading…",
    p_upload: "Upload photos",
    p_limits: (min, max) => `Minimum ${min}, maximum ${max} · JPG / PNG`,
    p_cover: "Cover",
    p_count: (n, min) => `${n} / ${min} minimum photos`,
    p_remove: "Remove photo",
    p_tour_t: "3D tour (optional)",
    p_tour_d: "You make it with our app, from your phone · Pro plan",
    p_tour_how: "How it works",
    p_tour_open: "Open the 3D app",
    p_tour_soon: "The 3D tour app — coming soon",
    p_boost_t: "Boost this listing",
    p_boost_have: (n) => `you have ${n} boost${n === 1 ? "" : "s"}`,
    p_boost_none: "you have no boosts",
    p_boost_buy: "Buy boosts",
    p_boost_more: "buy more",
    p_boost_note: "Applied when you publish; the listing climbs as soon as it is approved.",
    p_boost_fail: "The listing is published, but the boost was not applied — your boosts stayed in your account.",
    p_plan_t: "Your plan",
    p_plan_none: "No plan",
    p_plan_see: "see the plans",
    p_tours_t: "3D tours",
    p_tours_have: (r, q) => `${r} of ${q} available`,
    p_tour_link_l: "3D tour link (optional)",
    p_tour_link_note: "Saved when you publish. The link can be changed once every 30 days.",
    p_tour_fail: "The listing is published, but the 3D tour was not saved — you can add it from your listing.",
    p_phone: "Phone",
    p_whatsapp: "WhatsApp",
    p_whatsapp_hint: "International format, e.g. 40759...",
    p_name: "Display name",
    p_name_hint: "Taken from your account",
    p_name_ph: "Owner name",
    p_role: "I am posting as",
    p_terms_pre: "I agree to the ",
    p_terms: "Terms",
    p_and: " and the ",
    p_privacy: "Privacy Policy",
    p_terms_note: "They open in a new tab — you will not lose what you have written.",
  },
};

// Tipul proprietății și rolul se SALVEAZĂ în română. Astea sunt doar afișaje.
export const PROPERTY_TYPE_EN = {
  "Garsonieră": "Studio flat",
  "2 Camere": "2 rooms",
  "3 Camere": "3 rooms",
  "4+ Camere": "4+ rooms",
  "Casă": "House",
  "Studio": "Studio",
};

export const SELLER_ROLE_EN = {
  Proprietar: "Owner",
  Agent: "Agent",
};

export function useWiz() {
  const { lang } = useCountry();
  const en = lang === "en";
  return { w: en ? WIZ.en : WIZ.ro, en };
}
