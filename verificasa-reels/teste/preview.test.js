// MP4-ul din preview/: durată, rezoluție, fps, codec, sunet. Rulează după scripts/randare.js.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const sc = require('../scenarii/ancpi-h1.json');

const mp4 = path.join(__dirname, '..', 'preview', `${sc.id}.mp4`);
const probe = () => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', mp4]).toString());

test('preview-ul există și are specificațiile din ghid', { skip: !fs.existsSync(mp4) && 'rulează întâi scripts/randare.js' }, () => {
  const p = probe();
  const v = p.streams.find((s) => s.codec_type === 'video');
  const a = p.streams.find((s) => s.codec_type === 'audio');
  assert.strictEqual(v.codec_name, 'h264');
  assert.strictEqual(v.width, 1080);
  assert.strictEqual(v.height, 1920);
  assert.strictEqual(v.pix_fmt, 'yuv420p');
  assert.strictEqual(v.color_space, 'bt709', 'culorile trebuie convertite în Rec.709');
  assert.strictEqual(v.color_primaries, 'bt709');
  assert.strictEqual(v.r_frame_rate, `${sc.fps}/1`);
  assert.ok(a, 'lipsește pista audio');
  const durata = parseFloat(p.format.duration);
  assert.ok(Math.abs(durata - sc.durata) < 0.15, `durata ${durata} ≠ ${sc.durata}`);
  assert.ok(durata >= 30 && durata <= 50);
});

test('vocea se aude pe tot parcursul (fără goluri lungi de liniște până la outro)', { skip: !fs.existsSync(mp4) && 'fără preview' }, () => {
  // silencedetect scrie în stderr
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', mp4, '-af', 'silencedetect=noise=-40dB:d=1.2', '-f', 'null', '-']);
  const goluri = (r.stderr.toString().match(/silence_start: [\d.]+/g) || [])
    .map((l) => parseFloat(l.split(': ')[1]))
    .filter((t) => t < sc.durata - 3);
  assert.deepStrictEqual(goluri, [], `goluri de liniște la: ${goluri.join(', ')}`);
});

test('coperta există și are 1080 × 1920', { skip: !fs.existsSync(mp4) && 'fără preview' }, () => {
  const png = mp4.replace(/\.mp4$/, '-coperta.png');
  assert.ok(fs.existsSync(png), 'lipsește coperta');
  const p = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', png]).toString());
  assert.strictEqual(p.streams[0].width, 1080);
  assert.strictEqual(p.streams[0].height, 1920);
});
