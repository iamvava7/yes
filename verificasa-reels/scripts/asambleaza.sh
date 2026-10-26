#!/usr/bin/env bash
# Asamblează cadrele PNG + vocea + efectele (+ muzica, dacă are licență) într-un MP4 H.264 1080×1920.
# Variabile: CADRE FPS DURATA VOCE SFX [MUZICA] IESIRE. De obicei e apelat de scripts/randare.js.
set -euo pipefail
: "${CADRE:?}" "${FPS:?}" "${DURATA:?}" "${VOCE:?}" "${SFX:?}" "${IESIRE:?}"
mkdir -p "$(dirname "$IESIRE")"

intrari=(-framerate "$FPS" -i "$CADRE/f_%05d.png" -i "$VOCE" -i "$SFX")
# Vocea e mereu mai tare decât muzica și efectele.
mix="[1:a]volume=1.0,apad[v];[2:a]volume=0.32[s];[v][s]amix=inputs=2:normalize=0:duration=longest[a0]"
if [[ -n "${MUZICA:-}" ]]; then
  intrari+=(-stream_loop -1 -i "$MUZICA")
  mix="[1:a]volume=1.0,apad,asplit[v][vk];[3:a]volume=0.18[m];[m][vk]sidechaincompress=threshold=0.05:ratio=6[md];[2:a]volume=0.32[s];[v][s][md]amix=inputs=3:normalize=0:duration=longest[a0]"
fi
mix="$mix;[a0]atrim=0:$DURATA,afade=t=out:st=$(echo "$DURATA - 0.4" | bc):d=0.4,alimiter=limit=0.95[a]"

ffmpeg -hide_banner -loglevel error -y "${intrari[@]}" \
  -filter_complex "$mix" -map 0:v -map "[a]" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r "$FPS" -profile:v high \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -t "$DURATA" "$IESIRE"
echo "  MP4: $IESIRE"
