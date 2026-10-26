// Validatorul: scenariul real trece, iar fiecare încălcare a regulilor e prinsă.
const test = require('node:test');
const assert = require('node:assert');
const { valideaza } = require('../scripts/valideaza.js');
const original = require('../scenarii/ancpi-h1.json');

const copie = () => JSON.parse(JSON.stringify(original));
// Caută scena după id și elementul după text, ca testele să nu depindă de ordinea din scenariu.
const scena = (sc, id) => sc.scene.find((s) => s.id === id);
const elem = (sc, id, text) => scena(sc, id).elemente.find((e) => e.text === text);
const erori = (sc) => valideaza(sc, { verificaFisiere: false }).erori.join('\n');

test('scenariul ancpi-h1 trece validarea (inclusiv fișierele audio și licențele)', () => {
  const r = valideaza(original);
  assert.deepStrictEqual(r.erori, []);
});

test('durata totală trebuie să fie suma scenelor', () => {
  const sc = copie(); sc.durata = 35;
  assert.match(erori(sc), /durata totală/);
});

test('durata în afara 30–50 s e respinsă', () => {
  const sc = copie(); scena(sc, 'grafic').durata += 15; sc.durata += 15;
  assert.match(erori(sc), /30–50/);
});

test('o cifră fără sursă e respinsă', () => {
  const sc = copie(); delete scena(sc, 'cifra').elemente.find((e) => e.tip === 'contor').sursa;
  assert.match(erori(sc), /nu are câmpul "sursa"/);
});

test('o sursă fără link sau publicație e respinsă', () => {
  const sc = copie(); sc.surse['svn-cotidianul'].url = '';
  assert.match(erori(sc), /lipsește linkul/);
  sc.surse['svn-cotidianul'].publicatie = '';
  assert.match(erori(sc), /numele publicației/);
});

test('text sub 48 px e respins', () => {
  const sc = copie(); elem(sc, 'hook-b', 'De la atacul de la').marime = 40;
  assert.match(erori(sc), /sub minimul de 48px/);
});

test('text în zona de siguranță de sus sau în stânga-jos e respins', () => {
  const sc = copie(); elem(sc, 'hook-a', 'ATENȚIE').y = 80;
  assert.match(erori(sc), /zona de siguranță de sus/);
  const sc2 = copie(); elem(sc2, 'hook-a', 'ATENȚIE').y = 1520;
  assert.match(erori(sc2), /stânga-jos|zona de siguranță de jos/);
});

test('un cadru nemișcat peste 1,5 s e respins (peste limita de respirație)', () => {
  const sc = copie();
  const g = scena(sc, 'grafic');
  g.elemente = g.elemente.slice(0, 2); // graficul rămâne fără ultimele bătăi
  delete g.elemente[1].diferenta;
  delete g.iesire;
  assert.match(erori(sc), /ritm/);
});

test('muzică fără licență e respinsă', () => {
  const sc = copie(); sc.muzica = { fisier: 'audio/muzica/x.mp3' };
  assert.match(erori(sc), /muzica are nevoie/);
});


test('stiluri din afara șablonului sunt respinse', () => {
  const sc = copie(); scena(sc, 'hook-a').fundal = 'roz'; elem(sc, 'hook-a', 'ATENȚIE').intrare = 'spirala';
  const e = erori(sc);
  assert.match(e, /fundal „roz”/);
  assert.match(e, /intrarea „spirala”/);
});

test('em-dash sau en-dash în textul de pe ecran e respins (minusul − e permis)', () => {
  const sc = copie(); elem(sc, 'cifra', 'București-Ilfov · T3 2026').text = 'București–Ilfov · T3 2026';
  assert.match(erori(sc), /em-dash\/en-dash/);
  assert.doesNotMatch(erori(copie()), /em-dash/);
});

test('contrast sub 4,5:1 e respins', () => {
  const sc = copie(); elem(sc, 'hook-a', 'ATENȚIE').culoare = 'alb'; // alb pe galben ≈ 1,5:1
  assert.match(erori(sc), /contrast/);
});

test('easing-ul trebuie să fie un ease GSAP valid', () => {
  const sc = copie(); elem(sc, 'hook-a', 'ATENȚIE').ease = 'wobbly.out';
  assert.match(erori(sc), /ease GSAP/);
  const ok = copie(); elem(ok, 'hook-a', 'ATENȚIE').ease = 'elastic.out(1, 0.5)';
  assert.doesNotMatch(erori(ok), /ease GSAP/);
});

test('coperta: text sub 60 px sau în afara centrului 3:4 e respins', () => {
  const sc = copie();
  const dupaText = (t) => sc.coperta.elemente.find((e) => e.text === t);
  dupaText('ATENȚIE').marime = 50;
  dupaText('Cadastrul s-a blocat').y = 1600;
  const e = erori(sc);
  assert.match(e, /coperta „ATENȚIE”: 50px/);
  assert.match(e, /centrul 3:4/);
});

test('efectele noi: ieșire, efect și orbită necunoscute sunt respinse', () => {
  const sc = copie();
  scena(sc, 'atac').iesire = 'teleport';
  elem(sc, 'atac', 'RANSOMWARE').efect = 'foc';
  scena(sc, 'notari').elemente.find((e) => e.tip === 'orbita').y = 1500;
  const e = erori(sc);
  assert.match(e, /ieșirea „teleport”/);
  assert.match(e, /efectul „foc”/);
  assert.match(e, /orbita iese din zona sigură/);
});

test('schimbarea de culoare trebuie să păstreze contrastul', () => {
  const sc = copie(); elem(sc, 'grafic', '−33%').culori = [{ t: 4.5, culoare: 'bleumarin' }];
  assert.match(erori(sc), /schimbarea în „bleumarin”/);
});
