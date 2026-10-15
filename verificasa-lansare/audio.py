# Original music bed + subtle SFX, generated in code (no copyrighted material).
# Usage: python3 audio.py build/timeline.json build/
import json, sys, wave
import numpy as np

SR = 48000
TL = json.load(open(sys.argv[1])); OUT = sys.argv[2]
D = TL['D']; S = TL['S']; AE = TL['AE']
n = int(SR * D); t = np.arange(n) / SR
rng = np.random.default_rng(7)

def note(m): return 440 * 2 ** ((m - 69) / 12)
def write(path, L, R):
    m = max(np.abs(L).max(), np.abs(R).max(), 1e-9); L, R = L / m * .89, R / m * .89
    d = (np.stack([L, R], 1) * 32767).astype(np.int16)
    w = wave.open(path, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes()); w.close()
def add(buf, sig, at, g=1.0):
    i = int(at * SR)
    if i < 0: sig, i = sig[-i:], 0
    if i >= len(buf): return
    j = min(len(buf), i + len(sig)); buf[i:j] += sig[:j - i] * g
def lp(x, a):  # one-pole low-pass
    y = np.empty_like(x); acc = 0.0
    for k in range(len(x)): acc += a * (x[k] - acc); y[k] = acc
    return y

# ---------------- music: calm ambient pads + slow pulse + end swell ----------------
L = np.zeros(n); R = np.zeros(n)
chords = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 69], [48, 55, 60, 64, 67], [55, 59, 62, 67, 69]]  # Am9, Fmaj7, Cadd9, G6
seg = 4 * 60 / 72 * 2  # two bars at 72 bpm
k = 0; st = -0.5
while st < D:
    ch = chords[k % 4]; ln = int((seg + 2.5) * SR); kk = np.arange(ln) / SR
    pad = np.zeros(ln)
    for m in ch:
        f = note(m)
        for det, ph in ((-.11, 0), (.11, 1.3), (0, 2.1)):
            pad += np.sin(2 * np.pi * f * (1 + det / 100) * kk + ph) * (1 + .25 * np.sin(2 * np.pi * .3 * kk + ph))
    env = np.minimum(1, kk / 1.6) * np.minimum(1, np.maximum(0, seg + 2.5 - kk) / 2.2)
    sig = pad * env / len(ch)
    add(L, sig, st, .11); add(R, np.roll(sig, 220), st, .11)
    b = note(ch[0] - 24); bass = np.sin(2 * np.pi * b * kk) * env
    add(L, bass, st, .16); add(R, bass, st, .16)
    k += 1; st += seg
# slow pulse (soft sub thump every beat at 72 bpm) from 2.3s to end of voice
kl = int(.5 * SR); kq = np.arange(kl) / SR
thump = np.sin(2 * np.pi * (48 + 30 * np.exp(-kq * 25)) * kq) * np.exp(-kq * 7)
x = S[1]
while x < AE + .3:
    add(L, thump, x, .22); add(R, thump, x, .22); x += 60 / 72
# sparse high bell notes
for i, at in enumerate(np.arange(1.0, AE, 60 / 72 * 2)):
    m = [76, 79, 74, 72, 76, 81][i % 6]; bl = int(2.2 * SR); bq = np.arange(bl) / SR
    bell = (np.sin(2 * np.pi * note(m) * bq) + .3 * np.sin(2 * np.pi * note(m) * 2.01 * bq)) * np.exp(-bq * 2.2) * np.minimum(1, bq / .01)
    pan = .3 * np.sin(i * 1.7); add(L, bell, at, .035 * (1 - pan)); add(R, bell, at, .035 * (1 + pan))
# end swell on the logo: brighter pad rising into the final card
sw0 = S[9]; swl = int((D - sw0) * SR); sq = np.arange(swl) / SR
swell = np.zeros(swl)
for m in [57, 64, 69, 72, 76, 81]:
    swell += np.sin(2 * np.pi * note(m) * sq) + .2 * np.sin(2 * np.pi * note(m) * 2 * sq + 1)
senv = np.minimum(1, sq / 1.8) ** 2 * np.minimum(1, np.maximum(0, (D - sw0) - sq) / 1.6)
add(L, swell * senv / 6, sw0, .2); add(R, np.roll(swell * senv / 6, 300), sw0, .2)
# room-ish echoes + global fades
def verb(s):
    o = s.copy()
    for d, g in ((.113, .32), (.197, .26), (.291, .2), (.417, .14), (.61, .09)):
        q = int(d * SR); o[q:] += s[:-q] * g
    return o
L, R = verb(L), verb(R)
fade = np.ones(n); fi = int(1.2 * SR); fade[:fi] = np.linspace(0, 1, fi) ** 2
fo = int(1.4 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
write(OUT + '/music.wav', L * fade, R * fade)

# ---------------- SFX ----------------
SL = np.zeros(n); SRt = np.zeros(n)
def whoosh(dur=.55):
    m = int(dur * SR); q = np.arange(m) / SR; noise = rng.standard_normal(m)
    a = .02 + .25 * np.sin(np.pi * q / dur) ** 2           # sweeping low-pass = soft air
    y = np.empty(m); acc = 0.0
    for i in range(m): acc += a[i] * (noise[i] - acc); y[i] = acc
    return y * np.sin(np.pi * q / dur) ** 2
def popsnd():
    m = int(.09 * SR); q = np.arange(m) / SR
    return np.sin(2 * np.pi * (520 + 500 * np.exp(-q * 45)) * q) * np.exp(-q * 38) * np.minimum(1, q / .002)
def click(m=int(.012 * SR)):
    q = np.arange(m) / SR; y = rng.standard_normal(m) * np.exp(-q * 400)
    return np.diff(np.concatenate([[0], y]))
def shutter():
    m = int(.2 * SR); y = np.zeros(m); c = click()
    y[:len(c)] += c; o = int(.075 * SR); y[o:o + len(c)] += c * .7
    q = np.arange(m) / SR; y += np.sin(2 * np.pi * 180 * q) * np.exp(-q * 60) * .15
    return y
def shimmer(dur=1.6):
    m = int(dur * SR); q = np.arange(m) / SR; y = np.zeros(m)
    for i, mm in enumerate([84, 88, 91, 96, 100]):
        on = i * .07; e = np.where(q > on, np.exp(-(q - on) * 2.6), 0) * np.minimum(1, np.maximum(0, q - on) / .01)
        y += np.sin(2 * np.pi * note(mm) * q) * e * (1 + .3 * np.sin(2 * np.pi * 9 * q))
    return y / 4
def put(sig, at, g, pan=0.0):
    add(SL, sig, at, g * (1 - pan)); add(SRt, sig, at, g * (1 + pan))

for i in range(1, 10): put(whoosh(), S[i] - .22, .55, .25 * np.sin(i))      # soft whoosh into each scene
for i in range(6): put(popsnd(), S[5] + .38 + i * .17, .35, .3 * np.sin(i * 2))  # furniture pop-ins
for i in range(4): put(popsnd(), S[8] + .05 + i * .16, .35, .2 * np.cos(i))    # pills
put(shutter(), S[7] + 1.35, .8)                                                 # camera shutter
put(shimmer(), S[1] + 1.28, .5); put(shimmer(2.0), S[9] + 1.1, .6)              # logo shimmer
write(OUT + '/sfx.wav', SL, SRt)
print('ok', D)
