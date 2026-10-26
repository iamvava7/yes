# python3 tools/build_audio.py <sfx.json> <out.wav> [voice.wav]
# Synthesises all sound effects and a soft music bed (no third-party samples), mixes the
# optional voice-over on top and ducks the music under it.
import json, sys, wave
import numpy as np

SR = 48000
rng = np.random.default_rng(7)

def env(n, a=0.005, r=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / a) if a else np.ones(n)
    return e * (np.exp(-t / r) if r else 1)

def lowpass(x, fc):
    fc = np.broadcast_to(fc, x.shape)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); z = 0.0
    for i in range(len(x)):
        z = (1 - a[i]) * x[i] + a[i] * z; y[i] = z
    return y

def tone(f, d, r, a=0.003):
    n = int(d * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(np.broadcast_to(f, (n,))) / SR
    return np.sin(ph) * env(n, a, r)

def noise(d): return rng.standard_normal(int(d * SR))

def whoosh(d=0.7):
    n = int(d * SR); x = noise(d); u = np.linspace(0, 1, n)
    y = lowpass(x, 300 + 5000 * np.sin(np.pi * u) ** 2) * np.sin(np.pi * u) ** 1.5
    return y * 0.9

def swish(): return whoosh(0.4) * 0.6

def pop():
    n = int(0.09 * SR); f = 900 * np.exp(-np.arange(n) / SR * 25) + 250
    return tone(f, 0.09, 0.03) * 0.5

def blip(): return tone(1500, 0.08, 0.025) * 0.3

def ding():
    return (tone(1318.5, 0.7, 0.22) * 0.35 + tone(1975.5, 0.7, 0.14) * 0.2)

def tick(): return lowpass(noise(0.02), 6000) * env(int(0.02 * SR), 0.0005, 0.003) * 0.6

def key(): return lowpass(noise(0.03), 4000) * env(int(0.03 * SR), 0.0005, 0.006) * 0.7

def tap(): return tone(2200, 0.03, 0.006) * 0.4 + key() * 0.6

def alarm():
    n = int(0.5 * SR); t = np.arange(n) / SR
    thud = tone(60 * np.exp(-t * 3), 0.5, 0.18) * 0.9
    two = np.sign(np.sin(2 * np.pi * np.where(t < 0.13, 660, 520) * t)) * env(n, 0.004, 0.12) * 0.12
    return thud + lowpass(two, 3000)

def error():
    n = int(0.4 * SR); t = np.arange(n) / SR
    saw = 2 * ((t * 150) % 1) - 1
    return lowpass(saw * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 18 * t))), 1800) * env(n, 0.005, 0.2) * 0.35

def stamp():
    t = np.arange(int(0.35 * SR)) / SR
    return tone(55 * np.exp(-t * 4), 0.35, 0.1) + lowpass(noise(0.35), 1500) * env(len(t), 0.001, 0.03) * 0.5

def rattle():
    out = np.zeros(int(0.9 * SR))
    for k in range(7):
        s = int(k * 0.11 * SR); c = tone(3200 + 300 * (k % 2), 0.05, 0.01) * 0.25 + key() * 0.4
        out[s:s + len(c)] += c[:len(out) - s]
    return out

def rise(d=0.8):
    n = int(d * SR); u = np.linspace(0, 1, n)
    return tone(220 * 2 ** (u * 2.3), d, None, 0.05) * u ** 2 * 0.18 + whoosh(d) * 0.3

def sparkle():
    out = np.zeros(int(0.9 * SR))
    for k, f in enumerate([2093, 2637, 3136, 4186]):
        c = tone(f, 0.5, 0.12) * 0.12; s = int(k * 0.07 * SR); out[s:s + len(c)] += c
    return out

def chime():
    out = np.zeros(int(2.0 * SR))
    for k, f in enumerate([523.25, 659.25, 783.99, 1046.5]):
        c = tone(f, 1.6, 0.5) * 0.18 + tone(f * 2, 1.6, 0.25) * 0.05; s = int(k * 0.11 * SR); out[s:s + len(c)] += c
    return out

def paper():
    d = 0.7; n = int(d * SR); u = np.linspace(0, 1, n)
    flutter = 0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 22 * u))
    return lowpass(noise(d), 3500) * flutter * np.sin(np.pi * u) * 0.35

SFX = dict(whoosh=whoosh, swish=swish, pop=pop, blip=blip, ding=ding, tick=tick, key=key, tap=tap, alarm=alarm,
           error=error, stamp=stamp, rattle=rattle, rise=rise, sparkle=sparkle, chime=chime, paper=paper)

def pad(total, scenes_dark_until):
    # Am - F - C - G, slow attack; brighter voicing after the turn of the story.
    n = int(total * SR); out = np.zeros(n); t = np.arange(n) / SR
    chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [130.81, 196, 261.63], [196, 246.94, 293.66]]
    L = 4.0
    for i in range(int(total / L) + 1):
        s = int(i * L * SR); e = min(n, int((i + 1) * L * SR + 0.5 * SR))
        if s >= n: break
        seg = np.arange(e - s) / SR; m = np.minimum(1, seg / 0.8) * np.minimum(1, (e - s) / SR - seg + 0.3)
        for f in chords[i % 4]:
            for det in (-0.6, 0.6):
                out[s:e] += np.sin(2 * np.pi * (f + det) * seg) * m * 0.05
                out[s:e] += np.sin(2 * np.pi * 2 * (f + det) * seg) * m * 0.012
    # gentle pulse
    for b in np.arange(0, total, 0.6):
        s = int(b * SR); c = tone(55, 0.3, 0.08) * 0.08; out[s:s + len(c)] += c[:max(0, n - s)]
    bright = np.clip((t - scenes_dark_until) / 2, 0, 1)
    return out * (0.8 + 0.4 * bright)

def read_wav(p):
    with wave.open(p) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
        if w.getnchannels() == 2: x = x.reshape(-1, 2).mean(1)
        assert w.getframerate() == SR, 'voice must be 48 kHz'
    return x

def main():
    data = json.load(open(sys.argv[1])); total = data['duration']; n = int(total * SR)
    fx = np.zeros(n)
    for ev in data['sfx']:
        c = SFX[ev['type']]() * ev.get('v', 1); s = int(ev['t'] * SR)
        if s < 0: c = c[-s:]; s = 0
        fx[s:s + len(c)] += c[:max(0, n - s)]
    music = pad(total, data.get('bright_at', total * 0.6)) * 0.55
    voice = np.zeros(n)
    if len(sys.argv) > 3:
        v = read_wav(sys.argv[3]); voice[:min(n, len(v))] = v[:n]
        act = lowpass(np.abs(voice), 4.0) > 0.01
        duck = lowpass(np.where(act, 0.4, 1.0), 3.0)
        music *= duck; fx *= 0.75
    mix = voice * 1.0 + fx * 0.8 + music
    mix /= max(1e-9, np.abs(mix).max()) / 0.89
    with wave.open(sys.argv[2], 'w') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())

main()
