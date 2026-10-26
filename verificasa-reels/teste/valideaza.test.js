// Validatorul: scenariul real trece, iar fiecare încălcare a regulilor e prinsă.
const test = require('node:test');
const assert = require('node:assert');
const { valideaza } = require('../scripts/valideaza.js');
const original = require('../scenarii/ancpi-h1.json');

const copie = () => JSON.parse(JSON.stringify(original));
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
  const sc = copie(); sc.scene[5].durata += 15; sc.durata += 15;
  assert.match(erori(sc), /30–50/);
});

test('o cifră fără sursă e respinsă', () => {
  const sc = copie(); delete sc.scene[1].elemente[1].sursa;
  assert.match(erori(sc), /nu are câmpul "sursa"/);
});

test('o sursă fără link sau publicație e respinsă', () => {
  const sc = copie(); sc.surse['svn-cotidianul'].url = '';
  assert.match(erori(sc), /lipsește linkul/);
  sc.surse['svn-cotidianul'].publicatie = '';
  assert.match(erori(sc), /numele publicației/);
});

test('text sub 48 px e respins', () => {
  const sc = copie(); sc.scene[0].elemente[1].marime = 40;
  assert.match(erori(sc), /sub minimul de 48px/);
});

test('text în zona de siguranță de sus sau în stânga-jos e respins', () => {
  const sc = copie(); sc.scene[0].elemente[0].y = 80;
  assert.match(erori(sc), /zona de siguranță de sus/);
  const sc2 = copie(); sc2.scene[0].elemente[0].y = 1520;
  assert.match(erori(sc2), /stânga-jos|zona de siguranță de jos/);
});

test('un cadru nemișcat peste 1,5 s e respins (peste limita de respirație)', () => {
  const sc = copie();
  sc.scene[5].elemente = sc.scene[5].elemente.slice(0, 2); // graficul rămâne fără ultimele bătăi
  assert.match(erori(sc), /ritm/);
});

test('muzică fără licență e respinsă', () => {
  const sc = copie(); sc.muzica = { fisier: 'audio/muzica/x.mp3' };
  assert.match(erori(sc), /muzica are nevoie/);
});

test('lipsa dezvăluirii AI e respinsă', () => {
  const sc = copie(); sc.scene.at(-1).elemente = sc.scene.at(-1).elemente.filter((e) => e.rol !== 'dezvaluire');
  assert.match(erori(sc), /dezvăluirea AI/);
});

test('stiluri din afara șablonului sunt respinse', () => {
  const sc = copie(); sc.scene[0].fundal = 'roz'; sc.scene[0].elemente[0].intrare = 'rotire';
  const e = erori(sc);
  assert.match(e, /fundal „roz”/);
  assert.match(e, /intrarea „rotire”/);
});
