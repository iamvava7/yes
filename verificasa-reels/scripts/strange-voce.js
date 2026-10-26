#!/usr/bin/env node
// Strânge pauzele dintr-o voce ElevenLabs și o accelerează ușor, păstrând harta timpilor.
// Folosire: node scripts/strange-voce.js audio/voce/<id>.segmente.json
// Fișierul .segmente.json descrie segmentele de vorbire din take-ul original și pauza dorită după fiecare.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const cfgPath = process.argv[2];
if (!cfgPath) {
  console.error('Folosire: node scripts/strange-voce.js audio/voce/<id>.segmente.json');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const dir = path.dirname(cfgPath);
const src = path.join(dir, cfg.sursa);
const out = path.join(dir, cfg.iesire);
const tempo = cfg.tempo || 1;
const pad = cfg.margine ?? 0.05;

const parts = [];
const map = [];
let t = 0;
cfg.segmente.forEach((s, i) => {
  const a = Math.max(0, s.de - pad);
  const b = s.la + pad;
  parts.push(`[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS[s${i}]`);
  map.push({ eticheta: s.eticheta || null, original: s.de, nou: +((t + (s.de - a)) / tempo).toFixed(3) });
  t += b - a;
  const gap = s.pauza ?? 0;
  if (gap > 0) {
    parts.push(`anullsrc=r=44100:cl=mono,atrim=0:${gap}[g${i}]`);
    t += gap;
  }
});
const labels = cfg.segmente.map((s, i) => `[s${i}]` + ((s.pauza ?? 0) > 0 ? `[g${i}]` : '')).join('');
const n = cfg.segmente.reduce((k, s) => k + 1 + ((s.pauza ?? 0) > 0 ? 1 : 0), 0);
const filter = parts.join(';') + `;${labels}concat=n=${n}:v=0:a=1,atempo=${tempo},loudnorm=I=-16:TP=-1.5:LRA=11[out]`;

execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-filter_complex', filter,
  '-map', '[out]', '-ar', '48000', '-ac', '1', out], { stdio: 'inherit' });

const durata = +(t / tempo).toFixed(3);
const harta = { sursa: cfg.sursa, iesire: cfg.iesire, tempo, durata, repere: map };
fs.writeFileSync(out.replace(/\.wav$/, '.timpi.json'), JSON.stringify(harta, null, 2) + '\n');
console.log(JSON.stringify(harta, null, 2));
