#!/usr/bin/env bash
set -euo pipefail

export PATH="$ANDROID_HOME/platform-tools:$PATH"
device() { adb -s "$ANDROID_SERIAL" "$@"; }
before=$(cat "$RUNNER_TEMP/duo-widget-before-reboot")
before_id=$(sed -nE 's/.* ids=([0-9]+) .*/\1/p' <<<"$before")
before_values=${before#* skin=}
test -n "$before_id"
bash duo-qa/native-home-gesture.sh prepare
old_boot=$(device shell cat /proc/sys/kernel/random/boot_id | tr -d '\r')
device reboot
timeout 180 adb -s "$ANDROID_SERIAL" wait-for-device
timeout 240 bash -c 'until [[ $(adb -s "$ANDROID_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d "\r") == 1 ]]; do sleep 2; done'
new_boot=$(device shell cat /proc/sys/kernel/random/boot_id | tr -d '\r')
test -n "$new_boot" && test "$new_boot" != "$old_boot"
device shell input keyevent KEYCODE_WAKEUP
device shell wm dismiss-keyguard
device shell am start -W -n review.duo.widgetcheck/.HostActivity --es phase reboot
for attempt in {1..45}; do
  log=$(device logcat -d -s 'DuoWidgetQA:I' '*:S' | tr -d '\r')
  if grep -q 'FAIL reboot' <<<"$log"; then
    echo "$log" >&2; exit 1
  fi
  match=$(grep -F 'READY reboot ' <<<"$log" | tail -1 || true)
  if [[ -n "$match" ]]; then
    [[ "$match" == *" ids=$before_id "* ]]
    [[ "${match#* skin=}" == "$before_values" ]]
    echo "$match"
    echo 'PASS: OS reboot retained the same bound widget ID, balance, background and button.'
    bash duo-qa/native-home-gesture.sh verify-pin
    bash duo-qa/same-avd-power-cycle.sh
    device shell am start -W -n review.duo.widgetcheck/.HostActivity --es phase powercycle
    for retry in {1..45}; do
      cold=$(device logcat -d -s 'DuoWidgetQA:I' '*:S' | tr -d '\r' | grep 'READY powercycle ' | tail -1 || true)
      if [[ -n "$cold" ]]; then break; fi
      sleep 1
    done
    [[ "$cold" == *" ids=$before_id "* ]]
    [[ "${cold#* skin=}" == "$before_values" ]]
    echo "$cold"
    echo 'PASS: the same widget also survives power-off and a cold boot on the retained data disk.'
    bash duo-qa/native-home-gesture.sh verify
    exit 0
  fi
  sleep 1
done
echo "The restored widget did not provide its saved RemoteViews after reboot" >&2
exit 1
