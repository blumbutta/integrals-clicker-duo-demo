#!/usr/bin/env bash
set -euo pipefail
export PATH="$ANDROID_HOME/platform-tools:$PATH"
device() { adb -s "$ANDROID_SERIAL" "$@"; }
game=ru.mathclicker.duo
default="$game/.ClickerActivity"
alternative="$game/.launcher.Icon_copper"
host="$game/.ClickerHostActivity"
launch() {
  device shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "$1"
}
foreground() {
  device shell dumpsys activity activities | awk '/mResumedActivity:/{print;exit}' | tr -d '\r'
}
find_host_task() {
  local line
  for attempt in {1..24}; do
    line=$(foreground)
    if [[ "$line" == *"$host"* ]]; then
      sed -nE 's/.* t([0-9]+)[ }].*/\1/p' <<<"$line"
      return
    fi
    sleep .5
  done
  echo "Unexpected foreground activity: $line" >&2
  return 1
}
assert_left() {
  for attempt in {1..20}; do
    local line
    line=$(foreground)
    if [[ -n "$line" && "$line" != *"$game/"* ]]; then echo "Reached $line"; return; fi
    sleep .5
  done
  return 1
}
assert_surface() {
  device shell dumpsys window windows > "$RUNNER_TEMP/duo-host-windows"
  python3 - "$RUNNER_TEMP/duo-host-windows" <<'PY'
import re, sys
windows = open(sys.argv[1]).read()
blocks = re.split(r'(?=^  Window #[0-9]+ Window\{)', windows, flags=re.M)
host = next((block for block in blocks if re.search(r'^  Window #[0-9]+ Window\{[^\n]*ru\.mathclicker\.duo/ru\.mathclicker\.duo\.ClickerHostActivity',block) and 'mHasSurface=true' in block),None)
if host is None: raise RuntimeError('No rendered game activity window')
for flag in ('HIDE_NAVIGATION','IMMERSIVE_STICKY','IMMERSIVE'):
    assert not re.search(r'(?<![\w_])'+flag+r'(?![\w_])',host),flag
print('Host activity has a drawn surface and no immersive / hide-navigation flag')
PY
}
# Make the second real, exported launcher alias available without changing the
# saved game. Shell applies its own component state; in-app selection is tested
# separately against the actual Java bridge for each supported Android API.
device root >/dev/null
device wait-for-device
device shell pm enable --user 0 "$alternative" | grep -F enabled
launch "$default"
original=$(find_host_task)
test -n "$original"
pid=$(device shell pidof -s "$game" | tr -d '\r')
test -n "$pid"
sleep 3
assert_surface
device shell input keyevent KEYCODE_HOME
assert_left
launch "$alternative"
test "$(find_host_task)" = "$original"
test "$(device shell pidof -s "$game" | tr -d '\r')" = "$pid"
sleep 1
assert_surface
echo "PASS: two distinct launcher icons lead to one existing game task $original, pid $pid"
device shell input keyevent KEYCODE_HOME
assert_left
launch "$game/.LauncherEntryActivity"
test "$(find_host_task)" = "$original"
test "$(device shell pidof -s "$game" | tr -d '\r')" = "$pid"
echo "PASS: the permanent game shortcut returns to the existing host task after Home"
device shell input keyevent KEYCODE_BACK
assert_left
echo 'PASS: Back during a saved tutorial exits to the underlying Android activity'
