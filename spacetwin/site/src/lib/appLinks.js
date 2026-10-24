// Aplicația VerifiCasa 3D și magazinele ei, într-un singur loc.
//
// Trei fișiere țineau fiecare propria constantă goală — subsolul, pasul 5 din
// formular și, de acum, pagina de prezentare. Când aplicația ajunge în
// magazine se completează AICI, o dată, și se aprind toate deodată.
//
// Cât timp o valoare e `null`, consumatorii NU desenează un link: desenează
// aceeași țintă stinsă, marcată „În curând". Un link mort către un magazin
// unde aplicația nu există e mai rău decât niciun link.

export const APP_STORE_URL = null;
export const PLAY_STORE_URL = null;

// Deep link / pagina de pornire a aplicației de captură, folosită de butonul
// din pasul „Poze & contact".
export const TOUR_3D_APP_URL = null;

// Formatul linkului pe care îl scoate aplicația. Trăiește aici pentru că îl
// folosesc și textele de prezentare, și exemplul din mockup — dacă se schimbă
// formatul, se schimbă într-un loc.
export const TOUR_3D_LINK_PREFIX = "verificasa.ro/3D/";
export const TOUR_3D_LINK_SAMPLE = `${TOUR_3D_LINK_PREFIX}A7K2M9`;

export const hasStoreLinks = () => Boolean(APP_STORE_URL || PLAY_STORE_URL);
