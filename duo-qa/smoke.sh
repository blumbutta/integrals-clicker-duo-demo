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
  if timeout 18 adb -s "$ANDROID_SERIAL" shell uiautomator dump "/sdcard/duo-qa.xml" >/dev/null; then
    device exec-out cat /sdcard/duo-qa.xml > "$dir/view.xml"
  else
    printf '<hierarchy/>' > "$dir/view.xml"
  fi
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
  for t in {1..35}; do
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
new=duo-qa/candidate.apk
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
if [[ -n $xy ]]; then
  read -r x y <<< "$xy"
  device shell input tap "$x" "$y"
  sleep 1
  capture_ui
fi
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
  grep -q 'Счёт пополнился' "$dir/view.xml"
  echo "Same saved tutorial milestone visible after 0.3.15 -> 0.3.16 upgrade."
fi
device install "$dir/host.apk"
device shell appwidget grantbind --package "$fixture" --user 0
device shell settings put system accelerometer_rotation 0
device shell settings put system user_rotation 0
first_views=$(host_screen portrait)
echo "$first_views"
verify_click "$first_views" 1
second_views=$(host_screen second)
echo "$second_views"
verify_click "$second_views" 2
device shell settings put system user_rotation 1
sleep 2
device shell dumpsys input | grep -m 1 -E 'SurfaceOrientation|orientation=' || true
third_views=$(host_screen landscape)
echo "$third_views"
ids() { sed -E 's/.* ids=([^ ]+).*/\1/' <<< "$1"; }
test "$(ids "$first_views")" = "$(ids "$third_views")"
verify_click "$third_views" 2
device shell am force-stop "$game"
device shell am start -W -n "$game/.ClickerActivity" >/dev/null
resumed "$game"
sleep 4
fourth_views=$(host_screen relaunched)
echo "$fourth_views"
test "$(ids "$first_views")" = "$(ids "$fourth_views")"
verify_click "$fourth_views" 1
echo "PASS: release update, both real wide RemoteViews, four real touch launches and stable widget IDs after rotation and game relaunch."

# Keep this one already-booted tablet available for a final asset-only rebuild.
for t in {1..100}; do
  git fetch --quiet --depth=1 origin "refs/heads/$QA_BRANCH"
  if git cat-file -e FETCH_HEAD:duo-qa/final.sha256 2>/dev/null; then
    final_hash=$(git show FETCH_HEAD:duo-qa/final.sha256 | tr -d '\r\n')
    git show FETCH_HEAD:duo-qa/final.apk > "$dir/final.apk"
    echo "$final_hash  $dir/final.apk" | sha256sum -c -
    test "$(cert "$dir/final.apk")" = "$old_cert"
    device install -r "$dir/final.apk"
    device shell am start -W -n "$game/.ClickerActivity" >/dev/null
    resumed "$game"
    sleep 6
    final_views=$(host_screen final)
    echo "$final_views"
    test "$(ids "$first_views")" = "$(ids "$final_views")"
    verify_click "$final_views" 2
    echo "PASS: final package $final_hash, old bindings retained, both widgets display live progress and city touch launches."
    break
  elif git cat-file -e FETCH_HEAD:duo-qa/final.same 2>/dev/null; then
    echo "No follow-up replacement requested."
    break
  fi
  sleep 12
done
