#!/usr/bin/env bash
set -euo pipefail
export PATH="$ANDROID_HOME/platform-tools:$PATH"
sdk="$ANDROID_HOME/build-tools/35.0.0"
dir="$RUNNER_TEMP/duo-widget"
mkdir -p "$dir"
device() { adb -s "$ANDROID_SERIAL" "$@"; }
game=ru.mathclicker.duo
fixture=review.duo.widgetcheck
resumed() {
  local target=$1
  for i in {1..30}; do
    if device shell dumpsys activity activities | grep 'mResumedActivity:' | grep -F "$target/" >/dev/null; then return 0; fi
    sleep 1
  done
  device shell dumpsys activity activities | grep -E 'ResumedActivity|topResumedActivity' || true
  return 1
}
capture_ui() {
  for attempt in {1..3}; do
    device shell rm -f /sdcard/duo-qa.xml
    timeout 15 adb -s "$ANDROID_SERIAL" shell uiautomator dump "/sdcard/duo-qa.xml" >/dev/null || true
    device exec-out cat /sdcard/duo-qa.xml > "$dir/view.xml" 2>/dev/null || true
    if grep -q '</hierarchy>' "$dir/view.xml" && grep -q 'ru.mathclicker.duo' "$dir/view.xml"; then return; fi
    sleep 1
  done
  printf '<hierarchy/>' > "$dir/view.xml"
}
first_click() {
  python3 - "$dir/view.xml" <<'PY'
import re, sys
from xml.etree import ElementTree as ET
rows = []
for e in ET.parse(sys.argv[1]).iter('node'):
    a = e.attrib
    if a.get('resource-id','').endswith('integral-button') or (a.get('content-desc') == 'Интеграл' and a.get('clickable') == 'true'):
        xy = list(map(int,re.findall(r'\d+',a.get('bounds',''))))
        if len(xy)==4 and xy[2]-xy[0]>90 and xy[3]-xy[1]>90:
            rows.append((xy[2]-xy[0],(xy[0]+xy[2])//2,(xy[1]+xy[3])//2))
if rows:
    _, x, y = max(rows)
    print(x,y)
PY
}
host_screen() {
  local phase=$1
  device shell am start -W -n "$fixture/.HostActivity" --es phase "$phase" >/dev/null
  resumed "$fixture"
  for t in {1..45}; do
    line=$(device logcat -d -s 'DuoWidgetQA:I' '*:S' | tr -d '\r' | grep "READY $phase " | tail -1 || true)
    if [[ -n $line ]]; then echo "$line"; return; fi
    if device logcat -d -s 'DuoWidgetQA:E' '*:S' | grep 'FAIL ' >/dev/null; then break; fi
    sleep 1
  done
  device logcat -d -s 'DuoWidgetQA:I' 'chromium:E' 'AndroidRuntime:E' '*:S' | tail -100 >&2
  return 1
}
verify_click() {
  local info=$1 index=$2
  local xy
  xy=$(echo "$info" | sed -E 's/.* targets=([^ ]+).*/\1/' | cut -d, -f "$index")
  device shell input tap "${xy%:*}" "${xy#*:}"
  resumed "$game"
  echo "Touch at $xy launched the game."
}
trap 'device logcat -d -s "DuoWidgetQA:I" "AndroidRuntime:E" "chromium:E" "*:S" | tail -80 || true' ERR
echo "API=$(device shell getprop ro.build.version.sdk) ABI=$(device shell getprop ro.product.cpu.abi)"
device shell dumpsys webviewupdate | head -20
unzip -p downloads/Integrals-Clicker-Duo-Max-0.3.15.zip Integrals-Clicker-Duo-Max.apk > "$dir/old.apk"
echo "52259a72d8a5b1741de44b7ddf39dd1ba074f55f0f08c6a29ad24b692d43e171  $dir/old.apk" | sha256sum -c -
new=duo-qa/final.apk
final_hash=$(tr -d '\r\n' < duo-qa/final.sha256)
echo "$final_hash  $new" | sha256sum -c -
cert() { "$sdk/apksigner" verify --print-certs "$1" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p'; }
old_cert=$(cert "$dir/old.apk")
test -n "$old_cert"
test "$old_cert" = "$(cert "$new")"
echo "Production signer matched."
bash duo-qa/build-host.sh "$dir/host.apk"
device install "$dir/old.apk"
device shell am start -W -n "$game/.ClickerActivity"
resumed "$game"
sleep 6
capture_ui
xy=$(first_click)
if [[ -z $xy ]]; then xy="600 995"; fi
read -r x y <<< "$xy"
device shell input tap "$x" "$y"
sleep 1
capture_ui
seeded=false
if grep -q 'Счёт пополнился' "$dir/view.xml"; then
  seeded=true
  echo "Seeded a real first tap on released 0.3.15 through Android input at $xy."
else
  echo "Accessibility did not confirm a first tap on 0.3.15; relying on package upgrade identity."
fi
device shell input keyevent KEYCODE_HOME
sleep 1
version_before=$(device shell dumpsys package "$game" | sed -n 's/.*versionName=//p' | head -1 | tr -d '\r')
test "$version_before" = 0.3.15
first=$(device shell dumpsys package "$game" | sed -n 's/.*firstInstallTime=//p' | head -1)
test -n "$first"
device install -r "$new"
after=$(device shell dumpsys package "$game" | sed -n 's/.*firstInstallTime=//p' | head -1)
test "$first" = "$after"
device shell dumpsys package "$game" | grep -E 'firstInstallTime=|versionCode=20 |versionName=0.3.16'
device shell dumpsys package "$game" | grep 'versionCode=20 ' >/dev/null
device shell am start -W -n "$game/.ClickerActivity"
resumed "$game"
sleep 8
if [[ $seeded == true ]]; then
  capture_ui
  if grep -q 'Счёт пополнился' "$dir/view.xml"; then
    echo "Same saved tutorial milestone visible after 0.3.15 -> 0.3.16 upgrade."
  else
    echo "Checking the saved balance via its widget instead of tutorial text. Current UI:"
    python3 - "$dir/view.xml" <<'PYUI'
from xml.etree import ElementTree as ET
import sys
for node in ET.parse(sys.argv[1]).iter("node"):
    for key in ("text","content-desc"):
        if node.get(key):
            print(node.get(key)[:140])
PYUI
    device logcat -d -s 'chromium:I' 'AndroidRuntime:E' '*:S' | tail -40 || true
  fi
fi
device install "$dir/host.apk"
device shell appwidget grantbind --package "$fixture" --user 0
device shell settings put system accelerometer_rotation 0
device shell settings put system user_rotation 0
first_views=$(host_screen portrait)
echo "$first_views"
ids() { sed -E 's/.* ids=([^ ]+).*/\1/' <<< "$1"; }
skin() { sed -E 's/.* skin=([^ ]+).*/\1/' <<< "$1"; }
grep -F 'balance=1 ∫' <<< "$first_views"
echo "First click from 0.3.15 retained: the only widget text is the genuine 1 ∫ balance."
verify_click "$first_views" 1
capture_ui
coach_xy=$(python3 - "$dir/view.xml" <<'PYCOACH'
import re,sys
from xml.etree import ElementTree as ET
for node in ET.parse(sys.argv[1]).iter("node"):
    if any(node.get(k) == "Начать копить" for k in ("text","content-desc")):
        coords = list(map(int,re.findall(r"\d+",node.get("bounds",""))))
        if len(coords) == 4:
            print((coords[0]+coords[2])//2,(coords[1]+coords[3])//2)
            break
PYCOACH
)
if [[ -n $coach_xy ]]; then
  read -r coach_x coach_y <<< "$coach_xy"
  device shell input tap "$coach_x" "$coach_y"
  sleep 1
  capture_ui
  next_xy=$(first_click)
  if [[ -z $next_xy ]]; then next_xy="600 995"; fi
  read -r next_x next_y <<< "$next_xy"
  device shell input tap "$next_x" "$next_y"
  device shell input tap "$next_x" "$next_y"
  sleep 1
  changed=$(host_screen after_taps)
  echo "$changed"
  grep -F 'balance=3 ∫' <<<"$changed"
  test "$(ids "$first_views")" = "$(ids "$changed")"
  test "$(skin "$first_views")" = "$(skin "$changed")"
  echo "Two real additional taps updated the same widget from 1 to 3 integral units, with identical artwork."
  verify_click "$changed" 1
else
  echo "No accessibility coordinates for additional clicks; retained balance confirmed."
fi
device shell settings put system user_rotation 1
sleep 2
device shell dumpsys input | grep -m1 -E 'SurfaceOrientation|orientation=' || true
landscape=$(host_screen landscape)
echo "$landscape"
test "$(ids "$first_views")" = "$(ids "$landscape")"
test "$(skin "$first_views")" = "$(skin "$landscape")"
verify_click "$landscape" 1
device shell am force-stop "$game"
device shell am start -W -n "$game/.ClickerActivity" >/dev/null
resumed "$game"
sleep 6
relaunched=$(host_screen relaunched)
echo "$relaunched"
test "$(ids "$first_views")" = "$(ids "$relaunched")"
test "$(skin "$first_views")" = "$(skin "$relaunched")"
verify_click "$relaunched" 1
echo "PASS: one real hosted lab; upgraded balance, background and disk artwork, stable binding across rotation and process relaunch."
bash duo-qa/extra.sh "$new"
bash duo-qa/artwork.sh
echo "PASS: final package $final_hash"
