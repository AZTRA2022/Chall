#!/usr/bin/env bash
# Convertit les sons de notif .mp3 -> .wav (PCM 16-bit) pour iOS.
# iOS n'accepte pas .mp3 comme son de notif custom : il faut .wav/.caf/.aiff (<= 30 s).
# Requiert ffmpeg :  brew install ffmpeg  (ou apt install ffmpeg)
#
# Après conversion :
#   1. remplace les .mp3 par .wav dans app.json > plugins > expo-notifications > sounds
#   2. remplace les valeurs de SOUNDS dans src/lib/notifications.ts (ex: "notif-1.wav")
#   3. rebuild le dev-client (npx expo run:ios)
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../assets/sounds" && pwd)"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg introuvable. Installe-le puis relance." >&2
  exit 1
fi

for f in "$DIR"/*.mp3; do
  out="${f%.mp3}.wav"
  echo "-> $out"
  ffmpeg -y -loglevel error -i "$f" -ar 44100 -ac 2 -c:a pcm_s16le "$out"
done

echo "OK. Sons .wav générés dans $DIR"
