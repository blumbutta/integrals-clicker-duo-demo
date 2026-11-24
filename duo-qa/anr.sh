#!/usr/bin/env bash
set -euo pipefail
export PATH="$ANDROID_HOME/platform-tools:$PATH"
device(){ adb -s "$ANDROID_SERIAL" "$@"; }
game=ru.mathclicker.duo
dir="$RUNNER_TEMP/duo-anr"
mkdir -p "$dir"
sed '/^old=\$(cat .*duo-widget-before-reboot/,$d' duo-qa/exit-dialog.sh > "$dir/exit-standalone.sh"
sed '/^bash duo-qa\/exit-dialog.sh/d' duo-qa/launcher-reentry.sh > "$dir/change.sh"
device root >/dev/null
device wait-for-device
device shell settings put system screen_off_timeout 1800000
device shell settings put system accelerometer_rotation 0
device shell settings put system user_rotation 1
bad=0
probe(){
  local desc=$1 which=$2 ok=0
  echo "Start $desc"
  if [[ "$which" == home || "$which" == back ]];then
    device shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n "$game/.ClickerActivity"
    sleep 8
    if [[ "$which" == home ]];then device shell input keyevent KEYCODE_HOME;else device shell input keyevent KEYCODE_BACK;fi
    for attempt in {1..30};do
      focus=$(device shell dumpsys activity activities | awk '/mResumedActivity:/{line=$0}END{print line}')
      [[ -n "$focus" && "$focus" != *"$game/"* ]] && break
      sleep .15
    done
  fi
  if [[ "$which" == aliases ]];then bash "$dir/change.sh" || ok=1; fi
  if [[ "$ok" == 0 ]];then timeout 150 bash "$dir/exit-standalone.sh" || ok=1;fi
  if [[ "$ok" == 1 ]];then
    echo "FAIL $desc"
    device shell dumpsys activity lastanr | head -25 || true
    device logcat -b events -d | grep -E 'am_anr|am_crash|wm_on_resume_called' | tail -10 || true
    device shell am force-stop "$game"
    sleep 1
    bad=1
  else
    echo "PASS $desc: native dialog Stay, Android Back, confirmed exit and subsequent relaunch."
  fi
}
old="$dir/old.apk"
curl -fsSL --retry 2 --max-time 150 'https://blumbutta.github.io/integrals-clicker-duo-demo/downloads/Integrals-Clicker-Duo-Max-0.3.19.apk' -o "$old"
echo "4628f4122d261f7596e8c7df180ea1082f16666b184c3f7c9b73e130cfd84d80  $old"|sha256sum -c -
device install "$old"
probe '0.3.19 one enabled alias + Home + immediate relaunch' home
probe '0.3.19 one enabled alias + Back + immediate relaunch' back
probe '0.3.19 two deliberately enabled aliases, Home, Back, then immediate relaunch' aliases
device shell pm default-state --user 0 "$game/.launcher.Icon_copper" >/dev/null
echo "bf45e396799322bf2d6ef2ec7ba05510e58491254e323646e6da5520e1621add  duo-qa/final.apk"|sha256sum -c -
device install -r duo-qa/final.apk
probe '0.3.20 one enabled alias + Home + immediate relaunch' home
probe '0.3.20 one enabled alias + Back + immediate relaunch' back
probe '0.3.20 two deliberately enabled aliases, Home, Back, then immediate relaunch' aliases
exit "$bad"
