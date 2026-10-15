// VerifiCasa – lansare „În curând”. Toate textele și timing-urile într-un singur loc.
window.CFG = {
  W: 1080, H: 1920, fps: 30,
  audioOffset: 0.5,   // secunde de liniște înainte de voiceover
  tail: 2.95,         // final pe logo după ultimul cuvânt
  colors: {
    bg: '#0A0D12', card: '#111821',
    g1: '#2ECC71', g2: '#16A34A',
    text: '#F9FAFB', muted: '#9CA3AF',
  },

  // Voiceover: textul afișat (exact, din brief) + intervalele măsurate pe voiceover.mp3
  // (timp audio, secunde). parts = [start, end, nrCuvinte] unde există pauze interne.
  lines: [
    { text: 'Imobiliarele se schimbă.', t: [0.05, 1.52] },
    { text: 'Iar VerifiCasa e aproape gata de lansare.', t: [1.97, 4.63] },
    { text: 'Cumpărătorii vor să vadă totul, înainte de vizionare.', t: [4.97, 7.81] },
    { text: 'De aceea, îmbunătățim tururile virtuale 3D.', t: [8.12, 11.10] },
    { text: 'Adăugăm planuri de etaj și planuri 3D.', t: [11.38, 13.85] },
    { text: 'Home staging virtual, care mobilează orice cameră.', t: [14.11, 17.06] },
    { text: 'Randări video 3D.', t: [17.35, 18.81], parts: [[17.35, 18.25, 2], [18.37, 18.81, 1]] },
    { text: 'Și o cameră foto smart, gândită pentru imobiliare.', t: [19.03, 21.84] },
    { text: 'Și multe altele.', t: [22.06, 23.15] },
    { text: 'VerifiCasa. În curând.', t: [23.39, 25.05], parts: [[23.39, 24.20, 1], [24.52, 25.05, 2]] },
  ],

  s1: { title: 'Imobiliarele', accent: 'se schimbă.' },
  s2: { wordA: 'Verifi', wordB: 'Casa' },
  s3: { a: 'Vezi', accent: 'totul.', b: 'Înainte de vizionare.' },
  s4: { label: 'TURURI VIRTUALE 3D' },
  s5: { label1: 'PLANURI DE ETAJ', label2: 'PLANURI 3D' },
  s6: { label: 'HOME STAGING VIRTUAL', before: 'Înainte', after: 'După' },
  s7: { label: 'RANDĂRI VIDEO 3D' },
  s8: { label: 'CAMERĂ FOTO SMART' },
  s9: { pills: ['Istoricul proprietății', 'Rapoarte PDF', 'Asistent AI', 'Mesagerie securizată'] },
  s10: { accent: 'În curând', url: 'verificasa.ro', stores: 'În curând pe App Store și Google Play' },
};
