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
  // tour viewer (Figma design)
  'Show details': 'Arată detaliile',
  'Details': 'Detalii',
  'Hide details': 'Ascunde detaliile',
  'Save': 'Salvează',
  'Saved': 'Salvat',
  'Copy link': 'Copiază linkul',
  'Full screen': 'Ecran complet',
  'views': 'vizualizări',
  'Captured on site with the VerifiCasa app': 'Filmat la fața locului cu aplicația VerifiCasa',
  'Captured by': 'Capturat de',
  'Agent': 'Agent',
  'Owner': 'Proprietar',
  'Listing': 'Anunț',
  'Report': 'Raportează',
  '3D tour hosted by': 'Tur 3D găzduit de',
  'Loading 3D tour': 'Se încarcă turul 3D',
  'Loading 3D tour · {pct}%': 'Se încarcă turul 3D · {pct}%',
  'Tip: use the floor plan to jump between rooms': 'Sfat: folosește planul ca să sari între camere',
  'Room {n} of {total}': 'Camera {n} din {total}',
  'Drag to look around · Click a circle to walk': 'Trage ca să te uiți în jur · Atinge un cerc ca să mergi',
  'Saved on this device': 'Salvat pe acest dispozitiv',
  'Removed from saved': 'Șters din salvate',
  'Link copied': 'Link copiat',
  'Copy this link': 'Copiază acest link',
  'Scanned {date}': 'Scanat {date}',
  'at the listing address': 'la adresa din anunț',
  '{m} m from the listing address': 'la {m} m de adresa din anunț',
  // agent home: VerifiCasa listings
  'Loading listings…': 'Se încarcă anunțurile…',
  'Search by title or neighbourhood': 'Caută după titlu sau cartier',
  'Search VerifiCasa listings': 'Caută în anunțurile VerifiCasa',
  'Your VerifiCasa listings': 'Anunțurile tale VerifiCasa',
  'Pick a listing to capture its 3D tour. Its price, address and contact come with it.': 'Alege un anunț ca să-i faci turul 3D. Prețul, adresa și contactul vin odată cu el.',
  'VerifiCasa is not reachable right now ({error}).': 'VerifiCasa nu răspunde acum ({error}).',
  'No listing matches “{q}”.': 'Niciun anunț nu se potrivește cu „{q}”.',
  'No published listings yet.': 'Încă nu sunt anunțuri publicate.',
  'No photo': 'Fără fotografie',
  ' / month': ' / lună',
  'rooms': 'camere',
  'View tour': 'Vezi turul',
  'Create 3D tour': 'Creează turul 3D',
  'Add rooms': 'Adaugă camere',
  // Maria
  'Ask Maria, the VerifiCasa assistant': 'Întreab-o pe Maria, asistentul VerifiCasa',
  'Ask Maria about this home…': 'Întreab-o pe Maria despre această locuință…',
  'Your question for Maria': 'Întrebarea ta pentru Maria',
  'Speak your question': 'Spune întrebarea',
  'About the price': 'Despre preț',
  'How much does it cost?': 'Cât costă?',
  'Rooms & sizes': 'Camere și suprafețe',
  'What rooms does it have and how big are they?': 'Ce camere are și cât de mari sunt?',
  'Location & area': 'Locație și zonă',
  'Where is it exactly?': 'Unde se află exact?',
  'Take me to…': 'Du-mă la…',
  'Show me the rooms': 'Arată-mi camerele',
  'Book a viewing': 'Programează o vizionare',
  'I would like to arrange a viewing': 'Aș vrea să programez o vizionare',
  'Maria, the VerifiCasa assistant': 'Maria, asistentul VerifiCasa',
  'VerifiCasa AI · only about this home': 'AI VerifiCasa · doar despre această locuință',
  'Hi! I’m Maria. I’ll help you explore {title}. Ask me about the price, the rooms, the area, or how to arrange a viewing.': 'Bună! Sunt Maria și te ajut să descoperi {title}. Întreabă-mă despre preț, camere, zonă sau cum programezi o vizionare.',
  'Sorry, I couldn’t answer just now ({error}). Try again in a moment.': 'Îmi pare rău, nu am putut răspunde acum ({error}). Încearcă din nou peste puțin.',
  'Go to {name}': 'Mergi la {name}',
  'Map of {place}': 'Harta zonei {place}',
  'Approximate area': 'Zona aproximativă',
  'Open in Maps': 'Deschide în Hărți',
  'Hello! I saw the 3D tour of {title} on VerifiCasa and I’d like to know more.': 'Bună ziua! Am văzut turul 3D pentru {title} pe VerifiCasa și aș vrea mai multe detalii.',
  'Message on VerifiCasa': 'Mesaj pe VerifiCasa',
  'Stop reading answers aloud': 'Nu mai citi răspunsurile cu voce tare',
  'Read answers aloud': 'Citește răspunsurile cu voce tare',
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
