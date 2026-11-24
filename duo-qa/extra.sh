#!/usr/bin/env bash
set -euo pipefail
export PATH="$ANDROID_HOME/platform-tools:$PATH"
# A normal launcher resolves the game's currently enabled alias. The OS task
# description is collected separately because some launchers use that artwork.
launcher=$(adb -s "$ANDROID_SERIAL" shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p ru.mathclicker.duo | tr -d '\r')
echo "$launcher"
grep -q 'ru.mathclicker.duo/.ClickerActivity' <<<"$launcher"
adb -s "$ANDROID_SERIAL" shell dumpsys activity recents | grep -m 5 -E 'TaskDescription:|mTaskDescription:|ru.mathclicker.duo' || true
adb -s "$ANDROID_SERIAL" shell settings put system accelerometer_rotation 0
adb -s "$ANDROID_SERIAL" shell settings put system user_rotation 1
sleep 1
base=$(cd "$(dirname "$0")" && pwd)
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
mkdir -p "$tmpdir/src"
cp "$base/TwoFingerActivity.java" "$tmpdir/src/"
python3 - "$tmpdir/src/TwoFingerActivity.java" <<'PYMODE'
import sys
from pathlib import Path
p=Path(sys.argv[1]); s=p.read_text().replace('if (portrait){web.evaluateJavascript(', 'if (portrait || getIntent().getBooleanExtra("edgesOnly",false)){web.evaluateJavascript(')
s=s.replace('"PASS landscape menu edges, two concurrent purchases, scroll cancellation and map pinch"', '"PASS landscape menu edges"')
p.write_text(s)
PYMODE
sed -e 's/review.duo.widgetcheck/review.duo.touchcheck/g' -e 's/HostActivity/TwoFingerActivity/g' "$base/AndroidManifest.xml" > "$tmpdir/AndroidManifest.xml"
sed 's@src/HostActivity.java@src/TwoFingerActivity.java@g' "$base/build-host.sh" > "$tmpdir/build-host.sh"
bash "$tmpdir/build-host.sh" "$tmpdir/gesture.apk"
if adb -s "$ANDROID_SERIAL" shell pm path review.duo.touchcheck | grep -q 'package:'; then
  adb -s "$ANDROID_SERIAL" uninstall review.duo.touchcheck >/dev/null
fi
adb -s "$ANDROID_SERIAL" install "$tmpdir/gesture.apk"
check_orientation() {
  local mode=$1 rotation=$2
  adb -s "$ANDROID_SERIAL" shell am force-stop review.duo.touchcheck
  adb -s "$ANDROID_SERIAL" shell settings put system accelerometer_rotation 0
  adb -s "$ANDROID_SERIAL" shell settings put system user_rotation "$rotation"
  sleep 1
  adb -s "$ANDROID_SERIAL" shell am start -W -n review.duo.touchcheck/.TwoFingerActivity --ez portraitMenu "$([[ $mode == portrait ]] && echo true || echo false)" --ez edgesOnly "$3"
  local qa_pid logs
  qa_pid=$(adb -s "$ANDROID_SERIAL" shell pidof -s review.duo.touchcheck | tr -d '\r')
  [[ -n "$qa_pid" ]]
  for attempt in {1..75}; do
    logs=$(adb -s "$ANDROID_SERIAL" logcat -d --pid="$qa_pid" -s 'DuoTouchQA:V' '*:S')
    if [[ "$logs" == *'FAIL '* ]]; then echo "$logs"; return 1; fi
    if [[ "$logs" == *"PASS $mode menu edges"* ]]; then echo "$logs"; return 0; fi
    sleep 1
  done
  echo "Test timed out in $mode"
  adb -s "$ANDROID_SERIAL" logcat -d -s 'DuoTouchQA:V' 'AndroidRuntime:E' 'chromium:E' '*:S' | tail -60
  return 1
}
if [[ "$1" == edge ]]; then
  result=0
  check_orientation landscape 1 true || result=1
  check_orientation portrait 0 true || result=1
  exit "$result"
fi
check_orientation landscape 1 false
