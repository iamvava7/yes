#!/usr/bin/env bash
# Fundal muzical sintetizat local (fără bibliotecă externă): puls de tensiune pentru știri, 100 BPM.
# Kick pe fiecare timp, hi-hat pe contratimp, bas și un acord minor susținut (La minor).
# Folosire: scripts/muzica.sh <secunde> [fisier]   (implicit audio/muzica/puls-100bpm.wav)
set -euo pipefail
D="${1:-45}"
OUT="${2:-$(dirname "$0")/../audio/muzica/puls-100bpm.wav}"
B=0.6 # 100 BPM
ff() { ffmpeg -hide_banner -loglevel error -y "$@"; }
TMP="$(mktemp -d)"
ff -f lavfi -i "aevalsrc='0.9*sin(2*PI*(42+95*exp(-35*mod(t,$B)))*mod(t,$B))*exp(-9*mod(t,$B))':d=$D:s=48000" -ac 1 "$TMP/kick.wav"
ff -f lavfi -i "aevalsrc='(random(0)-0.5)*exp(-70*mod(t+$B/2,$B))*0.5':d=$D:s=48000" -af "highpass=f=7000,volume=0.6" -ac 1 "$TMP/hat.wav"
# bas: La (55 Hz) pe 4 timpi, Fa (43.65 Hz) pe următorii 4
ff -f lavfi -i "aevalsrc='0.55*sin(2*PI*if(lt(mod(t,$B*8),$B*4),55,43.65)*t)*(0.6+0.4*exp(-4*mod(t,$B)))':d=$D:s=48000" -af "lowpass=f=220" -ac 1 "$TMP/bas.wav"
# pad: La minor (A3 C4 E4) cu vibrato lent, filtrat ca să stea sub voce
ff -f lavfi -i "aevalsrc='0.18*(sin(2*PI*220*t+0.6*sin(2*PI*0.2*t))+sin(2*PI*261.63*t)+sin(2*PI*329.63*t)+0.5*sin(2*PI*440.5*t))':d=$D:s=48000" \
   -af "lowpass=f=1400,tremolo=f=0.25:d=0.3" -ac 1 "$TMP/pad.wav"
ff -i "$TMP/kick.wav" -i "$TMP/hat.wav" -i "$TMP/bas.wav" -i "$TMP/pad.wav" \
   -filter_complex "[0][1][2][3]amix=inputs=4:normalize=0,afade=t=in:d=0.4,afade=t=out:st=$(echo "$D - 1.5" | bc):d=1.5,loudnorm=I=-20:TP=-3:LRA=7" \
   -ar 48000 -ac 2 "$OUT"
rm -rf "$TMP"
echo "$OUT"
