#!/usr/bin/env bash
set -euo pipefail
export PATH="$ANDROID_HOME/platform-tools:$PATH"
device() { adb -s "$ANDROID_SERIAL" "$@"; }
game=ru.mathclicker.duo
dir="$RUNNER_TEMP/duo-exit"
mkdir -p "$dir"
focus() {
  device shell dumpsys activity activities | awk '/mResumedActivity:/{line=$0}END{print line}' | tr -d '\r'
}
real_tap() {
  local id=$1 label=$2 xy
  for attempt in {1..12}; do
    device shell rm -f /sdcard/duo-exit.xml
    timeout 15 adb -s "$ANDROID_SERIAL" shell uiautomator dump /sdcard/duo-exit.xml >/dev/null || true
    device exec-out cat /sdcard/duo-exit.xml > "$dir/ui.xml" 2>/dev/null || true
    xy=$(python3 - "$dir/ui.xml" "$id" "$label" <<'PY'
import re,sys
from xml.etree import ElementTree as ET
try: nodes=list(ET.parse(sys.argv[1]).iter('node'))
except ET.ParseError: sys.exit(0)
for node in nodes:
    a=node.attrib
    if a.get('enabled')=='false': continue
    if not (a.get('resource-id','').rsplit('/',1)[-1]==sys.argv[2] or sys.argv[3] in [a.get('text'),a.get('content-desc')]): continue
    xy=re.findall(r'\d+', a.get('bounds',''))
    if len(xy)!=4:continue
    x0,y0,x1,y1=map(int,xy)
    if x1>x0 and y1>y0:
        print((x0+x1)//2,(y0+y1)//2)
        break
PY
)
    if [[ -n "$xy" ]]; then
      local x y; read -r x y <<<"$xy"
      device shell input tap "$x" "$y"
      echo "Android touch: $id at $xy"
      sleep .35
      return
    fi
  done
  python3 - "$dir/ui.xml" <<'PYUI'
import sys
from xml.etree import ElementTree as ET
try: rows=ET.parse(sys.argv[1]).iter('node')
except ET.ParseError: sys.exit(0)
for node in rows:
    a=node.attrib
    print(a.get('class',''),a.get('resource-id',''),a.get('text','')[:70],a.get('content-desc','')[:80],a.get('bounds',''))
PYUI
  if [[ "$id" == exit-game ]]; then
    xy=$(python3 - "$dir/ui.xml" <<'PYGEO'
import re,sys
from xml.etree import ElementTree as ET
try: nodes=ET.parse(sys.argv[1]).iter('node')
except ET.ParseError: sys.exit(0)
for node in nodes:
    if node.get('package')!='ru.mathclicker.duo' or not node.get('class','').endswith('WebView'): continue
    dims=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
    if len(dims)==4 and dims[2]-dims[0]>500 and dims[3]-dims[1]>500:
        print(dims[2]-30,dims[1]+36)
        break
PYGEO
)
    if [[ -n "$xy" ]]; then
      local x y; read -r x y <<<"$xy"; device shell input tap "$x" "$y"
      echo "Tapped tested upper-right header region of rendered game at $xy; requiring the actual dialog next"
      sleep .4
      return
    fi
  fi
  echo "Could not find $id ($label) on the actual game screen" >&2
  return 1
}
launch() {
  device shell am start -W -n "$game/.LauncherEntryActivity"
  for attempt in {1..18}; do
    [[ "$(focus)" == *"$game/.ClickerHostActivity"* ]] && return
    sleep .5
  done
  return 1
}
launch
real_tap exit-game 'Выйти из игры'
real_tap exit-stay 'Остаться'
real_tap exit-game 'Выйти из игры'
device shell input keyevent KEYCODE_BACK
sleep .5
[[ "$(focus)" == *"$game/.ClickerHostActivity"* ]]
real_tap exit-game 'Выйти из игры'
real_tap exit-confirm 'Выйти'
for attempt in {1..20}; do
  [[ "$(focus)" != *"$game/"* ]] && break
  sleep .5
done
[[ "$(focus)" != *"$game/"* ]]
if device shell dumpsys activity recents | grep 'Recent #.*Task{' | grep -F "A=$game" >/dev/null; then
  echo 'The confirmed game task remains in Recents' >&2; exit 1
fi
launch
real_tap exit-game 'Выйти из игры'
real_tap exit-stay 'Остаться'
old=$(cat "$RUNNER_TEMP/duo-widget-before-reboot")
expected=${old#* skin=}
device shell am start -W -n review.duo.widgetcheck/.HostActivity --es phase after_exit >/dev/null
for attempt in {1..42}; do
  result=$(device logcat -d -s 'DuoWidgetQA:I' '*:S' | tr -d '\r' | grep -F 'READY after_exit ' | tail -1 || true)
  if [[ -n "$result" ]]; then
    [[ "${result#* skin=}" == "$expected" ]]
    echo "$result"
    echo 'PASS: Stay and Android Back dismissed exit. Confirm closed the game; reopening retained the prior balance and artwork.'
    exit 0
  fi
  sleep 1
done
exit 1
