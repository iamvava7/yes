#!/usr/bin/env bash
# Sintetizează efectele sonore de bază în audio/sfx/ (fără biblioteci externe, fără licențe terțe).
set -euo pipefail
cd "$(dirname "$0")/../audio/sfx"
ff() { ffmpeg -hide_banner -loglevel error -y "$@"; }
ff -f lavfi -i "anoisesrc=d=0.5:c=pink:a=0.6" \
   -af "highpass=f=500,lowpass=f=5000,afade=t=in:d=0.3:curve=exp,afade=t=out:st=0.3:d=0.2,volume=0.55" -ar 48000 -ac 1 whoosh.wav
ff -f lavfi -i "aevalsrc='0.9*sin(2*PI*(45+140*exp(-25*t))*t)*exp(-6*t)+0.25*(random(0)-0.5)*exp(-40*t)':d=0.7:s=48000" \
   -af "lowpass=f=2500,volume=0.9" -ac 1 impact.wav
ff -f lavfi -i "aevalsrc='0.55*sin(2*PI*2400*t)*exp(-80*t)+0.3*sin(2*PI*1200*t)*exp(-60*t)':d=0.09:s=48000" -ac 1 click.wav
ls -1 *.wav
