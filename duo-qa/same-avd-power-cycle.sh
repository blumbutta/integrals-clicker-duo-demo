#!/usr/bin/env bash
# Recreate the virtual graphics process while preserving the tablet and all user data.
# The Android 11 guest otherwise keeps the emulator's stale EGL fence after adb reboot.
set -euo pipefail
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export ANDROID_USER_HOME="$RUNNER_TEMP/duo-android-user"
export ANDROID_AVD_HOME="$ANDROID_USER_HOME/avd"
device(){ adb -s "$ANDROID_SERIAL" "$@"; }
old=$(device shell cat /proc/sys/kernel/random/boot_id | tr -d '\r')
test -n "$old"
device shell sync
device emu kill
for attempt in {1..60}; do
  [[ ! -d "$ANDROID_AVD_HOME/DuoApi30.avd/hardware-qemu.ini.lock" ]] && ! adb devices | grep -F "$ANDROID_SERIAL" >/dev/null && break
  sleep 1
done
emulator -avd DuoApi30 -port 5556 -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader -accel on -cores 2 -memory 2456 >>/tmp/duo-emulator.log 2>&1 </dev/null &
pid=$!
sleep 4
kill -0 "$pid" || { tail -30 /tmp/duo-emulator.log; exit 1; }
timeout 180 adb -s "$ANDROID_SERIAL" wait-for-device
timeout 240 bash -c 'until [[ $(adb -s "$ANDROID_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d "\r") == 1 ]]; do sleep 2; done'
test "$old" != "$(device shell cat /proc/sys/kernel/random/boot_id | tr -d '\r')"
device shell input keyevent KEYCODE_WAKEUP
device shell wm dismiss-keyguard
device shell wm size 1200x1920
device shell wm density 160
echo 'Same tablet powered back up on the existing data disk with fresh graphics.'
