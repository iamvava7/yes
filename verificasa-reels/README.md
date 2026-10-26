# verificasa-reels

Reels verticale 9:16 (1080 × 1920) pentru Instagram-ul VerifiCasa, randate din fișiere JSON de scenariu.
**Sistemul nu publică nimic.** Rezultatul ajunge în `preview/` și se publică doar de Andrei, după vizionarea integrală.

## Cerințe

- Node 18+ cu Playwright (Chromium) disponibil la `require('playwright')`
- FFmpeg + ffprobe, `bc`
- Fonturile sunt incluse în `sablon/fonturi/` (Inter Display, licență SIL OFL 1.1, vezi `COPYRIGHT-debian.txt`)
- GSAP e inclus în `sablon/vendor/` (licență standard GSAP, gratuită și pentru uz comercial)

## Cum rulezi tot

```bash
npm run sfx                                   # o singură dată: efectele sonore în audio/sfx/
scripts/muzica.sh 43                          # fundalul muzical provizoriu (43 s) în audio/muzica/
npm run valideaza -- scenarii/ancpi-h1.json   # verifică regulile, nu randează
npm run randare -- scenarii/ancpi-h1.json     # validează, randează, scrie preview/ancpi-h1.mp4
npm test                                      # validator, zone de siguranță, preview
```

Opțiuni pentru randare:
`--pana-la 8` (doar primele 8 s, în `preview/<id>-partial.mp4`), `--paralel 4` (pagini Chromium),
`--pastreaza-cadre` și `--doar-asamblare` (refolosește cadrele ca să schimbi doar sunetul).
Un Reel de 40 s la 24 fps durează ~5 minute.

## Cum funcționează

1. `scripts/valideaza.js` respinge scenariul dacă: durata ≠ suma scenelor sau e în afara 30–50 s;
   o cifră nu are `sursa` (cu link și publicație); textul are sub 48 px, iese din zonele de siguranță
   (120 px sus/jos, nimic în stânga-jos) sau ar avea peste 2 rânduri; cadrul stă nemișcat peste 1,5 s
   (excepție: maximum 2 „respirații” de până la 2,5 s); vocea/muzica/efectele nu au licență;
   scenariul folosește culori, fundaluri, intrări sau tranziții din afara șablonului;
   contrastul textului (și al fiecărei schimbări de culoare) e sub 4,5:1; apare em-dash/en-dash pe ecran; un `ease` nu e un ease GSAP valid;
   coperta are text sub 60 px sau în afara centrului 3:4.
   Zonele sigure sunt cele Instagram: ~250 px sus și ~350 px jos (mai stricte decât minimul de 120 px din ghid).
2. `sablon/` – `index.html` + `stiluri.css` + `tranzitii.js` (speed ramp, bătăi, sunete) + `motor.js`.
   Fiecare scenă e un `gsap.timeline({ paused: true })` (GSAP 3.13, inclus local în `sablon/vendor/`);
   `render(t)` face `tl.time(t)`, deci fiecare cadru e determinist.
3. `scripts/randare.js` – un PNG per cadru cu Playwright, pista de efecte sonore din momentele scenariului,
   apoi `scripts/asambleaza.sh` (H.264 Rec. 709, AAC, voce peste efecte și muzică). Cadrele din `randare/` se șterg după export.
   Scrie și coperta: `preview/<id>-coperta.png` (din câmpul `coperta` al scenariului).
4. Sincronizarea: vocea se transcrie cu ElevenLabs Scribe (`audio/voce/<id>.cuvinte.json`, timp pe fiecare cuvânt),
   iar fiecare element din scenariu pornește când e rostit cuvântul lui.
   `scripts/strange-voce.js` rămâne disponibil dacă o voce are pauze prea lungi (nu e folosit pentru ancpi-h1).
5. Sunet: vocea e mereu deasupra; muzica coboară automat când vorbește vocea (sidechain), efectele sunt
   puse automat din scenariu (whoosh la tăieturi, impact/undă la slam, riser + boom pe cifră, taste la typewriter,
   glitch, pop pe noduri). Totul e sintetizat local (`scripts/sfx.sh`, `scripts/muzica.sh`), fără licențe terțe.

## Scenariu (rezumat)

```jsonc
{
  "id": "ancpi-h1", "fps": 24, "rezolutie": [1080, 1920], "durata": 40.0,
  "voce": { "fisier": "...wav", "licenta": "...", "voice_id": "...", "surse": ["..."] },
  "muzica": null,                       // sau { "fisier", "licenta" }
  "surse": { "<id>": { "publicatie", "url", "afirmatie", "verificat": "da|partial" } },
  "scene": [{ "id", "durata", "fundal": "inchis|galben|negru", "tranzitie": "taiere|zoom|glisare|estompare",
              "speed_ramp": { "de", "la", "lent" },
              "elemente": [ /* text | contor | marcaj | bare | lista | punct | logo, fiecare cu "t" relativ la scenă */ ] }]
}
```

Elementul `text`: `text`, `t`, `y` (marginea de sus, px), `marime`, `greutate`, `culoare`, `sursa` (obligatoriu dacă are cifre),
`accent` (cuvinte evidențiate), `ease` opțional (orice ease GSAP standard, ex. `back.out(2)`), și:
- `intrare`: `slam` (cu tremur și undă de șoc) | `sus` | `cuvinte` | `litere` | `masca` (dezvăluire prin mască) |
  `rotire` (cuvinte care se întorc 3D) | `masina` (typewriter cu cursor, `viteza` în litere/s)
- `culori`: `[{ "t", "culoare" }]` – textul își schimbă culoarea pe ritm
- `efect`: `glitch` – decalaj RGB și tăieturi digitale

`marcaj` (`cerc` | `subliniere` | `fundal` = highlight de marker pe fiecare rând) desenează peste elementul anterior cu indexul `tinta`.
`orbita`: diagramă cu `centru` și `noduri` (`text`, `t`, `blocat` = momentul în care primește X roșu), `raza`, `rotatie`, `alerta`.
La nivel de scenă: `fundal` (`inchis` | `galben` | `albastru` | `negru`), `tranzitie` (`taiere` | `zoom` | `glisare` |
`estompare` | `flash` | `rotire`), `iesire` (`sus` | `jos` | `stanga` | `zoom` | `estompare`: toate elementele pleacă
înainte de tăietură), `speed_ramp`.
`bare` acceptă `diferenta: { "t": … }`: linie punctată + paranteză care arată scăderea dintre primele două bare.

Logo-ul oficial se pune în `media/brand/logo.svg`; fără el, outro-ul arată doar wordmark-ul tipografic.
Deciziile de design și motivul fiecărei animații: `docs/critica-design.md`.

## Structură

```
scenarii/     un JSON per Reel
sablon/       index.html, stiluri.css, tranzitii.js, motor.js, fonturi/, vendor/ (GSAP)
media/        brand/ (logo oficial), higgsfield/ (cu cost și dată), gratuite/ (cu link și licență), grafice/ (cu sursa)
audio/        voce/ (ElevenLabs + LICENTA.md), muzica/ (piese + licențe), sfx/ (sintetizate local)
randare/      cadre temporare (se șterg după export)
preview/      MP4-uri pentru aprobare
scripts/      randare.js, valideaza.js, asambleaza.sh, strange-voce.js, sfx.sh
teste/        node --test
docs/         critica-design.md
```
