#!/usr/bin/env bash
# Audio mix: VO -> -14 LUFS (2-pass loudnorm), music ~18 LU under voice with sidechain ducking, subtle SFX.
set -euo pipefail
cd "$(dirname "$0")"
D=$(python3 -c "import json;print(json.load(open('build/timeline.json'))['D'])")
OFF=$(grep -oE "audioOffset: [0-9.]+" src/config.js | grep -oE "[0-9.]+$")
M=$(ffmpeg -hide_banner -i voiceover.mp3 -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g(){ echo "$M" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -hide_banner -loglevel error -y -i voiceover.mp3 -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000,pan=stereo|c0=c0|c1=c0,adelay=${OFF}s:all=1,apad,atrim=0:$D" build/vo_norm.wav
ffmpeg -hide_banner -loglevel error -y -i build/music.wav -af "loudnorm=I=-32:TP=-8:LRA=11" -ar 48000 build/music_lvl.wav
ffmpeg -hide_banner -loglevel error -y -i build/sfx.wav -af "volume=-21dB" build/sfx_lvl.wav
ffmpeg -hide_banner -loglevel error -y -i build/vo_norm.wav -i build/music_lvl.wav -i build/sfx_lvl.wav -filter_complex \
 "[0]asplit=2[vo][key];[1][key]sidechaincompress=threshold=0.04:ratio=3:attack=30:release=450:makeup=1[duck];[vo][duck][2]amix=inputs=3:normalize=0,alimiter=limit=0.89:level=false[out]" \
 -map "[out]" -ar 48000 -t "$D" build/mix.wav
ffmpeg -hide_banner -i build/mix.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tail -2
