# python3 tools/align.py audio/voice.wav  -> rewrites timeline.js t0/t1 from the pauses in the voice
import re, subprocess, sys, json
wav = sys.argv[1]
log = subprocess.run(['ffmpeg', '-i', wav, '-af', 'silencedetect=noise=-38dB:d=0.2', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
dur = float(re.search(r'Duration: (\d+):(\d+):([\d.]+)', log).groups()[2]) + 60 * int(re.search(r'Duration: (\d+):(\d+)', log).group(2))
# speech islands
isl, cur = [], 0.0
for s, e in zip(starts, ends + [dur]):
    if s - cur > 0.05: isl.append([cur, s])
    cur = e
if dur - cur > 0.05: isl.append([cur, dur])
src = open('timeline.js').read()
tl = json.loads(src[src.index('{'):src.rindex('}') + 1])
n = len(tl['segs'])
# merge the shortest gaps until we have one island per voice line
gaps = sorted(range(len(isl) - 1), key=lambda i: isl[i + 1][0] - isl[i][1], reverse=True)[:n - 1]
cuts = sorted(gaps); merged, start = [], 0
for c in cuts + [len(isl) - 1]:
    merged.append([isl[start][0], isl[c][1]]); start = c + 1
isl = merged
assert len(isl) == n, f'found {len(isl)} speech islands, expected {n}'
for s, (a, b) in zip(tl['segs'], isl): s['t0'], s['t1'] = round(a, 2), round(b, 2)
tl['total'] = round(isl[-1][1] + 2.5, 2)
head = src[:src.index('window.TL')]
open('timeline.js', 'w').write(head + 'window.TL = ' + json.dumps(tl, ensure_ascii=False, indent=2) + ';\n')
print(json.dumps(tl['segs'], ensure_ascii=False, indent=1)); print('total', tl['total'])
