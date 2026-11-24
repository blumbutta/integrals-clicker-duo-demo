#!/usr/bin/env bash
set -euo pipefail
# A normal launcher resolves the game's currently enabled alias. The OS task
# description is collected separately because some launchers use that artwork.
launcher=$(adb -s "$ANDROID_SERIAL" shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p ru.mathclicker.duo | tr -d '\r')
echo "$launcher"
grep -q 'ru.mathclicker.duo/.ClickerActivity' <<<"$launcher"
adb -s "$ANDROID_SERIAL" shell dumpsys activity recents | grep -m 5 -E 'TaskDescription:|mTaskDescription:|ru.mathclicker.duo' || true
base=$(cd "$(dirname "$0")" && pwd)
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
mkdir -p "$tmpdir/src"
cp "$base/TwoFingerActivity.java" "$tmpdir/src/"
sed -e 's/review.duo.widgetcheck/review.duo.touchcheck/g' -e 's/HostActivity/TwoFingerActivity/g' "$base/AndroidManifest.xml" > "$tmpdir/AndroidManifest.xml"
sed 's@src/HostActivity.java@src/TwoFingerActivity.java@g' "$base/build-host.sh" > "$tmpdir/build-host.sh"
bash "$tmpdir/build-host.sh" "$tmpdir/gesture.apk"
adb -s "$ANDROID_SERIAL" install "$tmpdir/gesture.apk"
adb -s "$ANDROID_SERIAL" shell am start -W -n review.duo.touchcheck/.TwoFingerActivity
qa_pid=$(adb -s "$ANDROID_SERIAL" shell pidof -s review.duo.touchcheck | tr -d '\r')
[[ -n "$qa_pid" ]]
for attempt in {1..70}; do
  logs=$(adb -s "$ANDROID_SERIAL" logcat -d --pid="$qa_pid" -s 'DuoTouchQA:V' '*:S')
  if [[ "$logs" == *'FAIL '* ]]; then echo "$logs"; exit 1; fi
  if [[ "$logs" == *'and next tap opened school'* ]]; then echo "$logs"; exit 0; fi
  sleep 1
done
echo "Two-contact test timed out"
adb -s "$ANDROID_SERIAL" logcat -d -s 'DuoTouchQA:V' 'AndroidRuntime:E' 'chromium:E' '*:S' | tail -60
exit 1
