# Critica de design: ancpi-h1 (v1 → v2)

Recenzie făcută cu skill-urile `design-critique`, `accessibility-review`, `design-taste-frontend`,
`gsap-core`, `reels-script` și `instagram-reels-publishing`, pe cadrele randate din v1.
Etapă: rafinare (primul Reel, înainte de aprobare).

## Impresie generală

Hook-ul galben cu „ATENȚIE” se vede din prima secundă și se citește fără sunet. Cea mai mare problemă
din v1 era compoziția: textul stătea în jumătatea de sus, iar 40% din ecran rămânea gol. Pe lângă asta,
cifra-cheie apărea abia după secunda 3, iar graficul nu arăta cât de mare e scăderea.

## Ce am schimbat (v2)

| # | Problemă în v1 | Sursa regulii | Severitate | Rezolvare în v2 |
|---|---|---|---|---|
| 1 | Zone sigure de 120 px; Instagram acoperă ~250 px sus și ~350 px jos | instagram-reels-publishing | 🔴 | Validatorul cere 250 / 350 px; toate scenele recentrate în zona 250–1570 |
| 2 | Compoziție sus, jumătatea de jos goală | design-critique (ierarhie vizuală) | 🟡 | Blocurile de text centrate vertical în zona sigură (centru ~910 px) |
| 3 | −33% se fixa la 3,6 s; regula e hook în ~3 s | reels-script | 🟡 | Contorul durează 1,0 s și se oprește la 3,2 s; „ATENȚIE” intră din primul cadru |
| 4 | Graficul arăta două bare, dar nu și diferența | design-critique (ce atrage privirea) | 🟡 | Linie punctată la nivelul T3 2025 + paranteză galbenă care măsoară scăderea, lângă −33% |
| 5 | Roșu pe galben 4,22:1 | accessibility-review (WCAG 1.4.3) | 🟡 | Roșu închis `#a3161a`, 5,1:1; validatorul verifică contrastul ≥ 4,5:1 pentru fiecare text |
| 6 | En-dash în „București–Ilfov” | design-taste-frontend (interdicție em/en-dash) | 🟢 | Cratimă; validatorul respinge em/en-dash pe ecran, păstrează minusul „−” |
| 7 | Negru pur `#000` în scena „o lună” | design-taste-frontend | 🟢 | Off-black `#05070c` |
| 8 | Simbol de logo inventat (casă + bifă) | design-taste-frontend (fără SVG-uri desenate de mână) | 🟡 | Doar wordmark „VerifiCasa”; logo-ul oficial se folosește automat dacă e pus în `media/brand/logo.svg` |
| 9 | Un cuvânt singur pe ultimul rând („acte”, „urmează”, „blocat”) | design-critique (tipografie) | 🟢 | `text-wrap: balance` pe tot textul |
| 10 | Fără copertă; Instagram nu o lasă schimbată după publicare | instagram-reels-publishing | 🟡 | `preview/<id>-coperta.png`, text ≥ 60 px în centrul 3:4 al grilei, verificat de validator |
| 11 | MP4 convertit cu matricea BT.601 (culori ușor deplasate pe telefon) | instagram-reels-publishing (Rec. 709) | 🟢 | Conversie și etichete Rec. 709 în `asambleaza.sh`; testul verifică `color_space=bt709` |
| 12 | Animații scrise de mână, cu easing-uri limitate | gsap-core | 🟢 | Motor pe `gsap.timeline({ paused: true })` + `tl.time(t)`: `back.out` la slam, `expo.out` la contor, `elastic.out` la bare, `stagger` pe cuvinte și litere; barele cresc cu `scaleY`, nu cu `height` |

## Ierarhie vizuală (v2)

- **Ce atrage privirea primul:** cuvântul mare din fiecare scenă (ATENȚIE, −33%, 14 iulie 2026, actualizat). Corect: e informația pe care o spune vocea.
- **Ordinea de citire:** de sus în jos, o idee pe rând; fiecare rând nou apare când e rostit.
- **Accent:** o singură culoare de accent pe scenă (galben pentru cifre, verde pentru acțiune, roșu pentru problemă).

## De ce se mișcă fiecare lucru

| Animație | Ce comunică |
|---|---|
| Slam + tremur (ATENȚIE, „s-a blocat”, „tranzacții blocate”) | Alarmă: momentele care trebuie să oprească scroll-ul |
| Contor 0 → 33% | Mărimea scăderii, construită în fața privitorului |
| Cerc / subliniere desenate | Arată cuvântul despre care vorbește vocea în acel moment |
| Bare + paranteză | Comparația înainte/acum și diferența dintre ele |
| Litere pe rând + punct de lumină (scena „o lună”) | Pauză calmă după partea alarmantă (stil PartoMotion) |
| Speed ramp (scena „ce faci”) | Încetinește pe întrebare, accelerează spre răspuns |
| Puncte care se umplu în listă | Progresul prin consecințe, nu decor |

## Accesibilitate

| Text | Culoare | Fundal | Contrast | Minim | OK |
|---|---|---|---|---|---|
| Text principal | `#f8fafc` | `#0a1020` | 18,1:1 | 4,5:1 | ✅ |
| Text secundar | `#cbd5e1` | `#0a1020` | 12,8:1 | 4,5:1 | ✅ |
| Cifre | `#facc15` | `#0a1020` | 12,4:1 | 4,5:1 | ✅ |
| Acțiune | `#22c55e` | `#0a1020` | 8,3:1 | 4,5:1 | ✅ |
| Problemă | `#ef4444` | `#0a1020` | 5,0:1 | 4,5:1 | ✅ |
| Hook | `#0b1b3a` | `#facc15` | 11,1:1 | 4,5:1 | ✅ |
| „s-a blocat” | `#a3161a` | `#facc15` | 5,1:1 | 4,5:1 | ✅ |

Textul e ≥ 48 px (≥ 60 px pe copertă), maximum 2 rânduri, și tot ce spune vocea apare și pe ecran,
deci Reel-ul se înțelege fără sunet.

## Ce rămâne deschis

- **Muzică:** nu există încă o piesă licențiată.
- **Logo oficial:** de pus în `media/brand/logo.svg`.
- **Buclă la final:** outro-ul nu se leagă vizual de primul cadru. O variantă: ultimul cadru trece în galbenul din hook. De decis după prima vizionare.
- **Neaplicate, intenționat:** dark/light mode, `prefers-reduced-motion` și regulile de layout pentru site-uri din `design-taste-frontend` țin de pagini web, nu de un video randat. Validarea de publicare din `platform-specs-and-validation` ține de WoopSocial; aici nu se publică nimic.

## v3: voce nouă și mai mult motion

Feedback Andrei: vocea suna artificial, prea puține efecte vizuale.

- **Voce:** Madie (făcută pentru Reels) pe `eleven_v4`, cu indicații de interpretare, la tempo natural.
  v1 era accelerată 8% și cu pauzele tăiate, ceea ce o făcea să sune mecanic.
- **Sincronizare pe cuvinte:** transcriere Scribe cu timp per cuvânt; textul apare exact când e rostit.
- **Efecte noi, din referințele din ghid:**

| Efect | Unde | Referință |
|---|---|---|
| Fundal galben → albastru, tăietură cu flash | hook | Matt Lou (galben și albastru, contrast puternic) |
| Typewriter cu cursor | „De la atacul de la”, „Fără extras…”, „Cere extras…”, „@verificasaro” | kinetic type |
| Undă de șoc + tremur la slam | ATENȚIE, CADASTRU, ANCPI, actualizat | impact pe beat |
| Cifra își schimbă culoarea galben → roșu pe „scăzut” | −33% | Matt Lou (cuvinte care își schimbă culoarea) |
| Highlight de marker, rând cu rând | „peste o treime”, „Cere extras…”, „Date: SVN România” | marcaje pe elementele-cheie |
| Glitch RGB | RANSOMWARE | atacul cibernetic |
| Diagramă orbitală: ANCPI în centru, notari / bănci / cumpărători primesc X roșu | scena „notari” | Pooya Taheri (diagrame orbitale) |
| Cuvinte care se întorc 3D | „Rezultatul?”, „întârzieri” | tranziții de text |
| Mască | „București-Ilfov”, „piața a stat pe loc”, surse | PartoMotion (text care apare elegant) |
| Ieșiri kinetice (textul pleacă înainte de tăietură) | 7 din 11 scene | text kinetic: intrare, ieșire |
| Particule care plutesc | fundalurile închise și albastre | grafică în mișcare continuă |

- **Sunet:** 9 efecte sintetizate (inclusiv riser + boom pe cifră și taste la typewriter) și un fundal de 100 BPM
  care coboară sub voce. Loudness final -15 LUFS.
