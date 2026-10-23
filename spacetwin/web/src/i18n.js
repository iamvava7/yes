// Romanian and English for the pages buyers see (the tour and its listing).
//
// The English text is the key, so the code stays readable and a missing
// translation shows English rather than nothing. The language comes from
// ?lang=ro|en (in the address or after the #), then a remembered choice, then
// the browser; Romanian browsers get Romanian, everyone else English.

const RO = {
  // view modes and tools
  'Inside': 'Interior',
  'Dollhouse': 'Machetă 3D',
  'Floor plan': 'Plan',
  'Navigate': 'Navighează',
  'Measure': 'Măsoară',
  'Add tag': 'Adaugă notă',
  'Trace room': 'Conturează camera',
  'View mode': 'Mod de vizualizare',
  'Tools': 'Unelte',
  'Tour actions': 'Acțiuni tur',
  'Spots': 'Puncte de vedere',
  'Floor plan map: tap to move there': 'Harta planului: atinge ca să mergi acolo',
  // actions
  'Play guided tour': 'Pornește turul ghidat',
  'Pause guided tour': 'Oprește turul ghidat',
  'Tour': 'Tur',
  'Pause': 'Pauză',
  'Sound on': 'Sunet',
  'Sound off': 'Fără sunet',
  'Turn sound on': 'Pornește sunetul',
  'Turn sound off': 'Oprește sunetul',
  'Save this view as a photo': 'Salvează imaginea ca fotografie',
  'Snapshot': 'Foto',
  'Share or embed this tour': 'Distribuie sau încorporează turul',
  'Share': 'Distribuie',
  'Share this tour': 'Distribuie turul',
  'Share…': 'Distribuie…',
  'Link': 'Link',
  'Link for a VerifiCasa listing (Link Tur 3D)': 'Link pentru anunțul VerifiCasa (Link Tur 3D)',
  'Embed on a website': 'Încorporează pe un site',
  'Copy': 'Copiază',
  'Copied': 'Copiat',
  'Press ⌘C': 'Copiază manual',
  'Close': 'Închide',
  'Cancel': 'Anulează',
  'Clear': 'Șterge',
  'Open the full tour': 'Deschide turul complet',
  // measuring, tracing, tags
  'Tap two points on any surface to measure between them.': 'Atinge două puncte pe orice suprafață ca să măsori distanța dintre ele.',
  'Tap the second point.': 'Atinge al doilea punct.',
  'Keep adding corners, then tap the red first corner or press Enter to close the outline.': 'Adaugă colțuri în continuare, apoi atinge primul colț (roșu) sau apasă Enter ca să închizi conturul.',
  'Tap each corner where the walls meet the floor, going around the room ({n} so far).': 'Atinge fiecare colț unde pereții întâlnesc podeaua, pe rând, în jurul camerei ({n} până acum).',
  'Close outline': 'Închide conturul',
  'Now tap where the ceiling meets the wall, directly above the red corner, to set the room height.': 'Acum atinge locul unde tavanul întâlnește peretele, exact deasupra colțului roșu, ca să setezi înălțimea camerei.',
  'Use 2.6 m': 'Folosește 2,6 m',
  'Tap a surface to pin a note there.': 'Atinge o suprafață ca să fixezi o notă acolo.',
  'Label': 'Titlu',
  'Notes (optional)': 'Detalii (opțional)',
  'Tag label': 'Titlul notei',
  'Tag notes': 'Detaliile notei',
  'Save tag': 'Salvează nota',
  'Delete tag': 'Șterge nota',
  // tour page and listing
  'Tour not found': 'Turul nu a fost găsit',
  'This link may be mistyped, or the tour was deleted.': 'Linkul poate fi greșit sau turul a fost șters.',
  '3D tour': 'Tur 3D',
  'Property details': 'Detalii proprietate',
  'Show property details': 'Arată detaliile proprietății',
  'Edit this tour': 'Editează turul',
  'Nothing to tour yet': 'Turul nu are încă puncte',
  'This space has no 360° spots. Capture or upload some in the editor to build the tour.': 'Proprietatea nu are încă puncte 360°. Capturează sau încarcă din editor ca să construiești turul.',
  'Open editor': 'Deschide editorul',
  'Rooms': 'Camere',
  'Rooms and sizes': 'Camere și dimensiuni',
  '{h} m ceiling': 'tavan {h} m',
  'Open the floor plan view': 'Deschide planul',
  'Floor plan of {title}': 'Planul pentru {title}',
  'Open full size': 'Deschide la mărime completă',
  'Contact': 'Contact',
  'Call': 'Sună',
  'Email': 'Email',
  '3D tour by ': 'Tur 3D realizat de ',
  'Total area': 'Suprafață totală',
  // listing status
  'For sale': 'De vânzare',
  'For rent': 'De închiriat',
  'Under offer': 'Ofertă în curs',
  'Sold': 'Vândut',
  'Off market': 'Retras',
};

function detect() {
  const fromUrl = (s) => new URLSearchParams(s).get('lang');
  const asked = fromUrl(location.search) || fromUrl(location.hash.split('?')[1] ?? '');
  if (asked === 'ro' || asked === 'en') {
    try { localStorage.setItem('vc-lang', asked); } catch { /* private mode */ }
    return asked;
  }
  try {
    const saved = localStorage.getItem('vc-lang');
    if (saved === 'ro' || saved === 'en') return saved;
  } catch { /* private mode */ }
  return (navigator.languages ?? [navigator.language]).some((l) => /^ro\b/i.test(l ?? '')) ? 'ro' : 'en';
}

export const lang = detect();
document.documentElement.lang = lang;

/** Translate an English UI string; `{name}` placeholders are filled from `vars`. */
export function t(text, vars) {
  const s = (lang === 'ro' && RO[text]) || text;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s;
}

/** "1 bed" / "2 beds" in either language. */
export function countLabel(n, kind) {
  if (lang === 'ro') {
    const ro = { bed: ['dormitor', 'dormitoare'], bath: ['baie', 'băi'] }[kind];
    return `${n} ${n === 1 ? ro[0] : ro[1]}`;
  }
  return `${n} ${n === 1 ? kind : `${kind}s`}`;
}

/** Decimal number in the page language (Romanian uses a decimal comma). */
export function num(n, digits = 1) {
  return n.toLocaleString(lang === 'ro' ? 'ro-RO' : 'en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
