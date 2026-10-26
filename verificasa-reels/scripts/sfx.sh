#!/usr/bin/env bash
# Sintetizează efectele sonore în audio/sfx/ (fără biblioteci externe, fără licențe terțe).
set -euo pipefail
cd "$(dirname "$0")/../audio/sfx"
ff() { ffmpeg -hide_banner -loglevel error -y "$@"; }
# whoosh: zgomot roz filtrat care crește și scade
ff -f lavfi -i "anoisesrc=d=0.5:c=pink:a=0.6" \
   -af "highpass=f=500,lowpass=f=5000,afade=t=in:d=0.3:curve=exp,afade=t=out:st=0.3:d=0.2,volume=0.55" -ar 48000 -ac 1 whoosh.wav
# impact: lovitură joasă cu atac scurt
ff -f lavfi -i "aevalsrc='0.9*sin(2*PI*(45+140*exp(-25*t))*t)*exp(-6*t)+0.25*(random(0)-0.5)*exp(-40*t)':d=0.7:s=48000" \
   -af "lowpass=f=2500,volume=0.9" -ac 1 impact.wav
# boom: impact mai adânc, cu coadă lungă (cifra-cheie)
ff -f lavfi -i "aevalsrc='1.0*sin(2*PI*(38+110*exp(-18*t))*t)*exp(-3.2*t)+0.3*(random(0)-0.5)*exp(-25*t)':d=1.4:s=48000" \
   -af "lowpass=f=1800,aecho=0.6:0.4:60:0.25,volume=0.95" -ac 1 boom.wav
# riser: zgomot care urcă în frecvență și volum spre impact
ff -f lavfi -i "aevalsrc='(random(0)-0.5)*pow(t/1.0,2)*0.9':d=1.0:s=48000" \
   -af "highpass=f=800,lowpass=f=9000,afade=t=out:st=0.94:d=0.06,volume=0.5" -ac 1 riser.wav
# click și tastă de mașină de scris
ff -f lavfi -i "aevalsrc='0.55*sin(2*PI*2400*t)*exp(-80*t)+0.3*sin(2*PI*1200*t)*exp(-60*t)':d=0.09:s=48000" -ac 1 click.wav
ff -f lavfi -i "aevalsrc='0.7*(random(0)-0.5)*exp(-120*t)+0.35*sin(2*PI*3100*t)*exp(-150*t)':d=0.05:s=48000" \
   -af "bandpass=f=3200:w=2500,volume=0.8" -ac 1 tasta.wav
# swish: aer scurt pentru textul care apare prin mască sau rotire
ff -f lavfi -i "anoisesrc=d=0.28:c=white:a=0.5" \
   -af "bandpass=f=4000:w=3000,afade=t=in:d=0.12,afade=t=out:st=0.12:d=0.16,volume=0.4" -ar 48000 -ac 1 swish.wav
# glitch: bucăți digitale tăiate (ransomware, blocaje)
ff -f lavfi -i "aevalsrc='0.5*sgn(sin(2*PI*(220+880*floor(mod(t*40,4)))*t))*gt(mod(floor(t*55),3),0)':d=0.32:s=48000" \
   -af "lowpass=f=6000,afade=t=out:st=0.24:d=0.08,volume=0.35" -ac 1 glitch.wav
# pop: nod care apare pe orbită
ff -f lavfi -i "aevalsrc='0.7*sin(2*PI*(500+900*exp(-40*t))*t)*exp(-28*t)':d=0.18:s=48000" -ac 1 pop.wav
# Normalizare la un vârf țintă per sunet, ca nivelurile să fie echilibrate între ele.
declare -A VARF=([impact]=-3 [boom]=-2 [riser]=-7 [whoosh]=-8 [click]=-10 [tasta]=-14 [swish]=-11 [glitch]=-9 [pop]=-8)
for f in "${!VARF[@]}"; do
  max=$(ffmpeg -hide_banner -i "$f.wav" -af volumedetect -f null - 2>&1 | grep -oE 'max_volume: [-0-9.]+' | awk '{print $2}')
  ff -i "$f.wav" -af "volume=$(echo "${VARF[$f]} - ($max)" | bc)dB" "$f.tmp.wav" && mv "$f.tmp.wav" "$f.wav"
done
ls -1 *.wav
