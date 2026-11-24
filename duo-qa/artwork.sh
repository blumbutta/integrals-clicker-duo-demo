#!/usr/bin/env bash
set -euo pipefail
base=$(cd "$(dirname "$0")" && pwd)
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
apk="$RUNNER_TEMP/duo-art-fixture.apk"
if [[ ! -s "$apk" ]]; then
  mkdir -p "$tmpdir/src"
  cp "$base/ArtworkActivity.java" "$tmpdir/src/"
  sed -e 's/review.duo.widgetcheck/review.duo.artcheck/g' -e 's/HostActivity/ArtworkActivity/g' "$base/AndroidManifest.xml" > "$tmpdir/AndroidManifest.xml"
  sed 's@src/HostActivity.java@src/ArtworkActivity.java@g' "$base/build-host.sh" > "$tmpdir/build-host.sh"
  bash "$tmpdir/build-host.sh" "$apk"
  adb -s "$ANDROID_SERIAL" install "$apk"
fi
run_case(){
  local rotation=$1 gallery=$2 expected=$3 pid logs
  adb -s "$ANDROID_SERIAL" shell am force-stop review.duo.artcheck
  adb -s "$ANDROID_SERIAL" shell settings put system accelerometer_rotation 0
  adb -s "$ANDROID_SERIAL" shell settings put system user_rotation "$rotation"
  sleep 1
  adb -s "$ANDROID_SERIAL" shell am start -W -n review.duo.artcheck/.ArtworkActivity --es hostArtwork "$4" --ez galleryOnly "$gallery"
  pid=$(adb -s "$ANDROID_SERIAL" shell pidof -s review.duo.artcheck | tr -d '\r')
  for attempt in {1..60}; do
    logs=$(adb -s "$ANDROID_SERIAL" logcat -d --pid="$pid" -s 'DuoArtworkQA:V' 'AndroidRuntime:E' '*:S')
    if [[ "$logs" == *"FAIL "* ]]; then echo "$logs"; return 1; fi
    if [[ "$logs" == *"$expected"* ]]; then echo "$logs"; return 0; fi
    sleep 1
  done
  echo "$logs"
  return 1
}
if [[ ${2:-} == gallery ]]; then
  result=0
  run_case 1 true 'PASS gallery landscape' "$1" || result=1
  run_case 0 true 'PASS gallery portrait' "$1" || result=1
  exit "$result"
fi
run_case 1 false 'PASS independently' "$1"
