#!/usr/bin/env bash
set -euo pipefail
base=$(cd "$(dirname "$0")" && pwd)
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
mkdir -p "$tmpdir/src"
cp "$base/ArtworkActivity.java" "$tmpdir/src/"
sed -e 's/review.duo.widgetcheck/review.duo.artcheck/g' -e 's/HostActivity/ArtworkActivity/g' "$base/AndroidManifest.xml" > "$tmpdir/AndroidManifest.xml"
sed 's@src/HostActivity.java@src/ArtworkActivity.java@g' "$base/build-host.sh" > "$tmpdir/build-host.sh"
bash "$tmpdir/build-host.sh" "$tmpdir/art.apk"
adb -s "$ANDROID_SERIAL" install "$tmpdir/art.apk"
adb -s "$ANDROID_SERIAL" shell am start -W -n review.duo.artcheck/.ArtworkActivity --es hostArtwork "$1"
pid=$(adb -s "$ANDROID_SERIAL" shell pidof -s review.duo.artcheck | tr -d '\r')
for attempt in {1..65}; do
  logs=$(adb -s "$ANDROID_SERIAL" logcat -d --pid="$pid" -s 'DuoArtworkQA:V' 'AndroidRuntime:E' '*:S')
  if [[ "$logs" == *"FAIL "* ]]; then echo "$logs"; exit 1; fi
  if [[ "$logs" == *"PASS independently"* ]]; then echo "$logs"; exit 0; fi
  sleep 1
done
echo "$logs"
exit 1
