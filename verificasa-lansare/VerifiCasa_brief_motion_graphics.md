# VerifiCasa – Brief motion graphics: video de lansare („În curând”)

Toate textele de pe ecran sunt în limba română, cu diacritice corecte (ă, â, î, ș, ț – ș și ț cu virgulă, nu cu sedilă).

## 0. Fișiere
- voiceover.mp3 – voiceover ElevenLabs, voce caldă și calmă (obligatoriu).
- logo.png – logo oficial, negru pe transparent, 864x864.
- logo_alb.png – același logo, alb #F9FAFB, pentru fundal închis.

Cum arată logo-ul: monogramă „VC”. „V”-ul are formă de bifă (✓, ideea de „verificat”). „C”-ul e un arc deschis spre dreapta, cu o casă în interior (acoperiș „^” și fereastră pătrată cu 4 ochiuri). Monocrom, fără gradient. Conținutul vizibil ocupă aproximativ zona x 106–807, y 199–667.

Reguli logo:
- Folosește doar aceste fișiere. Nu redesena, nu reinterpreta, nu genera logo-ul.
- Pe fundal închis folosește logo_alb.png. Glow verde discret în spate e permis; nu recolora logo-ul în verde și nu-i schimba proporțiile.
- Idee de animație (scena 2 și final): V-ul se desenează ca o bifă, apoi C-ul se trasează ca arc, iar casa apare la final cu un pop discret. Realizează efectul cu măști peste PNG.

## 1. Specificații tehnice
- Format principal: vertical 9:16, 1080x1920, 30 fps, MP4 (H.264, AAC).
- Format secundar (doar după aprobare): 16:9, 1920x1080.
- Durată: dictată de voiceover (estimat 25–35 s) + 2–3 s final pe logo.
- Zone sigure Reels/TikTok: nimic important în primii ~250 px de sus și ultimii ~350 px de jos.
- Unealtă recomandată: Remotion (React). Alternativ Python + ffmpeg. Fără resurse cu copyright.

## 2. Brand
Paletă (temă dark):
- Fundal: #0A0D12
- Fundal secundar / carduri: #111821
- Accent (gradient): #2ECC71 → #16A34A
- Text principal: #F9FAFB
- Text secundar: #9CA3AF
Nu folosi alte nuanțe de verde (#1F7048, #22C55E etc.).

Fonturi (Google Fonts):
- Titluri / etichete: Montserrat Black (900) și SemiBold (600), MAJUSCULE la etichetele de funcții.
- Accent elegant (1–2 cuvinte maxim): Playfair Display Italic.

Wordmark: „Verifi” alb + „Casa” verde (gradientul de accent).

Stil vizual: premium, calm, tehnologic. Glassmorphism discret (carduri semi-transparente cu blur, bordură 1 px albă la ~10% opacitate). Glow verde difuz în fundal, care se mișcă lent. Linii fine de blueprint / grid de scanare la opacitate mică. Mișcări line și fluide (ease-in-out, spring cu damping mare). Fără glitch, fără tranziții agresive, fără camera shake.

## 3. Voiceover (text exact)
Eticheta „[calm, warm]” din ElevenLabs nu se aude și nu apare pe ecran.
1. Imobiliarele se schimbă.
2. Iar VerifiCasa e aproape gata de lansare.
3. Cumpărătorii vor să vadă totul, înainte de vizionare.
4. De aceea, îmbunătățim tururile virtuale 3D.
5. Adăugăm planuri de etaj și planuri 3D.
6. Home staging virtual, care mobilează orice cameră.
7. Randări video 3D.
8. Și o cameră foto smart, gândită pentru imobiliare.
9. Și multe altele.
10. VerifiCasa. În curând.

Notă: propoziția 3 poate fi regenerată cu „Chiriașii” în loc de „Cumpărătorii”. Subtitrarea trebuie să reproducă exact ce se aude în audio.

Sincronizare: transcrie audio-ul cu faster-whisper (model medium, limba ro) cu timestamps la nivel de cuvânt. Fiecare scenă începe pe prima silabă a propoziției ei; animațiile de intrare încep cu ~3 cadre înainte. Folosește transcrierea doar pentru timing; textul afișat vine din lista de mai sus.

## 4. Storyboard
Subtitrare vorbită: jos, în zona sigură, cuvânt cu cuvânt, Montserrat SemiBold alb, cuvântul curent evidențiat în verde. Etichetele mari de funcții sunt separate de subtitrare.

1. „Imobiliarele se schimbă.” – Glow verde care se aprinde lent; contur de casă desenat din linii care se transformă într-un grid digital. Text: „Imobiliarele” (Montserrat) + „se schimbă.” (Playfair Italic).
2. „Iar VerifiCasa e aproape gata de lansare.” – Reveal logo (animația bifă → arc → casă), wordmark scris dedesubt. Text: logo + „VerifiCasa”.
3. „Cumpărătorii vor să vadă totul...” – Mockup simplu de telefon desenat în cod, cu un anunț; o lupă scanează casa. Text: „Vezi totul. Înainte de vizionare.”
4. „...îmbunătățim tururile virtuale 3D.” – Cameră wireframe 3D care se rotește lent și trece de la neclar la clar. Text: TURURI VIRTUALE 3D.
5. „Adăugăm planuri de etaj și planuri 3D.” – Plan 2D desenat din linii (pereți, uși) care se ridică în 3D ca o machetă izometrică. Text: PLANURI DE ETAJ → PLANURI 3D.
6. „Home staging virtual...” – Cameră goală; mobilier (canapea, masă, lampă, forme simple) apare cu pop-in pe rând; slider before/after. Text: HOME STAGING VIRTUAL.
7. „Randări video 3D.” – Player video cu buton play; camera virtuală zboară printr-o cameră 3D. Text: RANDĂRI VIDEO 3D.
8. „Și o cameră foto smart...” – Viewfinder (colțuri, grilă), flash, poza devine mai luminoasă. Text: CAMERĂ FOTO SMART.
9. „Și multe altele.” – Pastile glassy în cascadă: „Istoricul proprietății” · „Rapoarte PDF” · „Asistent AI” · „Mesagerie securizată”.
10. „VerifiCasa. În curând.” – Elementele converg spre centru; logo mare cu glow. Text: logo + „În curând”.
Final (2–3 s după audio): logo · verificasa.ro · „În curând pe App Store și Google Play” (text simplu, fără insignele oficiale Apple/Google).

Toate ilustrațiile se desenează în cod (SVG / forme): linii subțiri, verde pe fundal închis. Fără imagini stock, fără oameni reali.

## 5. Audio
- Voiceover: normalizat la ~ -14 LUFS integrat.
- Muzică: originală / generată în cod, fără copyright. Ambient corporate calm, pad-uri moi, puls lent, la ~ -18 dB sub voce, cu ducking ușor. Mic swell la final pe logo.
- SFX subtile: whoosh moale la tranziții, pop discret la pastile și mobilier, click de shutter la camera foto, shimmer la apariția logo-ului.

## 6. Ce NU trebuie să apară
- Dată de lansare sau termene pentru funcții.
- „Descarcă acum” sau orice sugerează că aplicația e deja disponibilă.
- Cifre de tipul „peste 100 de proprietăți” sau statistici neverificate.
- „Pe orice telefon” sau alte promisiuni de compatibilitate.
- „Măsurători oficiale”, „certificat oficial”.
- Nume de alte branduri (CubiCasa, Matterport, Zillow etc.).
- Alte nuanțe de verde; culori stridente (roșu, mov, galben).
- Glitch, RGB split, camera shake, tranziții agresive.
- Logo modificat, redesenat sau generat.

## 7. Livrabile și pași
1. Randează câte un cadru PNG din fiecare scenă și arată-mi-le pentru aprobare înainte de animația completă.
2. După aprobare, randează VerifiCasa_lansare_9x16.mp4.
3. Verifică înainte de livrare: diacriticele, subtitrarea identică cu audio-ul, zonele sigure, logo-ul original nedeformat.
4. Abia apoi, dacă cer, varianta 16:9.
5. Păstrează proiectul editabil: componente pe scene, toate textele într-un singur fișier de configurare.
