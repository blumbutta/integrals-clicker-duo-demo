#!/usr/bin/env bash
# Run prepare before the existing tablet reboot, verify after the same reboot.
# The gesture test uses the production APK. The separately signed probe publishes
# a real shortcut using the exact release classes; it never changes the game's save.
set -euo pipefail
base=$(cd "$(dirname "$0")" && pwd)
device() { adb -s "$ANDROID_SERIAL" "$@"; }
q="$RUNNER_TEMP/duo-pin-and-gesture"
pkg=review.duo.pincheck
probe="$pkg/ru.mathclicker.duo.PinProbe"
mkdir -p "$q"
probe_phase(){
  local phase=$1
  device shell am start -W -n "$probe" --es phase "$phase" >/dev/null
  local logs
  for attempt in {1..25};do
    logs=$(device logcat -d -s DuoPinQA:I '*:S')
    if [[ "$logs" == *"FAIL $phase"* ]];then echo "$logs"; return 1; fi
    if [[ "$phase" == pin && "$logs" == *'UNSUPPORTED launcher'* ]];then
      echo 'System launcher does not support Android pinned shortcuts'; touch "$q/no-pin"; return
    fi
    if [[ "$logs" == *"PASS $phase"* ]];then echo "$phase verified"; return; fi
    sleep .4
  done
  echo "$logs"; return 1
}
confirm_pin(){
  local coords
  for attempt in {1..12};do
    device shell uiautomator dump /sdcard/qa-duo-pin.xml >/dev/null || continue
    device exec-out cat /sdcard/qa-duo-pin.xml > "$q/confirm.xml"
    coords=$(python3 - "$q/confirm.xml" <<'PY'
import xml.etree.ElementTree as E, re, sys
for n in E.parse(sys.argv[1]).iter('node'):
    res = n.get('resource-id','').rsplit('/',1)[-1]
    title = n.get('text','').strip().lower()
    if n.get('clickable')=='true' and (res in ('place_automatically','add_item_button','button1','add_item') or title in ('add automatically','add to home screen','add','добавить','добавить автоматически')):
        pts=list(map(int,re.findall(r'\d+', n.get('bounds',''))))
        if len(pts)==4:
            print((pts[0]+pts[2])//2,(pts[1]+pts[3])//2)
            break
PY
)
    if [[ -n "$coords" ]];then read -r x y <<<"$coords";device shell input tap "$x" "$y";sleep 1;return;fi
  done
  cat "$q/confirm.xml"; return 1
}
gesture(){
  local overlay=com.android.internal.systemui.navbar.gestural
  local before home focus dims x y h
  before=$(device shell cmd overlay list --user 0 | tr -d '\r' | awk '/^\[x\] com.android.internal.systemui.navbar\./ {print $2;exit}')
  local overlays
  overlays=$(device shell cmd overlay list --user 0)
  if [[ "$overlays" != *"$overlay"* ]];then
    echo 'Gesture overlay not available on this system image';return
  fi
  local rotation auto
  rotation=$(device shell settings get system user_rotation | tr -d '\r')
  auto=$(device shell settings get system accelerometer_rotation | tr -d '\r')
  device shell cmd overlay enable-exclusive --category --user 0 "$overlay"
  device shell settings put system accelerometer_rotation 0
  device shell settings put system user_rotation 0
  # Wait for SystemUI to apply the gesture inset, then launch the production surface.
  for attempt in {1..25};do
    [[ "$(device shell settings get secure navigation_mode | tr -d '\r')" == 2 ]] && break
    sleep .3
  done
  test "$(device shell settings get secure navigation_mode | tr -d '\r')" = 2
  home=$(device shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tr -d '\r' | tail -1 | cut -d/ -f1)
  device shell am start -W -n ru.mathclicker.duo/.LauncherEntryActivity >/dev/null
  sleep 4
  focus=$(device shell dumpsys activity activities | awk '/mResumedActivity:/{print;exit}')
  [[ "$focus" == *'ru.mathclicker.duo/.ClickerHostActivity'* ]]
  dims=$(device shell wm size | tr -d '\r' | tail -1 | sed -nE 's/.* ([0-9]+)x([0-9]+).*/\1 \2/p')
  read -r x h <<<"$dims";x=$((x/2));y=$((h-2))
  device shell input touchscreen swipe "$x" "$y" "$x" "$((h/2))" 230
  for attempt in {1..18};do
    focus=$(device shell dumpsys activity activities | awk '/mResumedActivity:/{print;exit}')
    [[ "$focus" == *"$home/"* ]] && break
    sleep .4
  done
  if [[ -n "$before" ]];then device shell cmd overlay enable-exclusive --category --user 0 "$before";fi
  device shell settings put system user_rotation "$rotation"
  device shell settings put system accelerometer_rotation "$auto"
  [[ -n "$home" && "$focus" == *"$home/"* ]]
  echo "PASS: real bottom-edge swipe from the production game reached $home"
}
case "${1:-}" in
 prepare)
   device install "$base/launcher-probe.apk"
   probe_phase pin
   if [[ ! -e "$q/no-pin" ]];then confirm_pin;probe_phase before;probe_phase switch;probe_phase check;fi
   ;;
 verify)
   result=0
   bash "$0" verify-pin || result=1
   bash "$0" swipe || result=1
   exit "$result" ;;
 verify-pin)
   if [[ ! -e "$q/no-pin" ]];then probe_phase check;echo 'PASS: Android launcher retained the same enabled pinned shortcut after an alias change and system reboot';fi
   ;;
 swipe) gesture ;;
 *) echo "Expected prepare or verify" >&2;exit 2;;
esac
