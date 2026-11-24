#!/usr/bin/env bash
set -eu
base=$(cd "$(dirname "$0")" && pwd)
build=$(mktemp -d)
trap 'rm -rf "$build"' EXIT
sdk="$ANDROID_HOME/build-tools/35.0.0"
android="$ANDROID_HOME/platforms/android-35/android.jar"
mkdir -p "$build/classes" "$build/dex"
javac -encoding UTF-8 -source 8 -target 8 -classpath "$android" -d "$build/classes" "$base/src/HostActivity.java"
jar cf "$build/classes.jar" -C "$build/classes" .
"$sdk/d8" --lib "$android" --min-api 23 --output "$build/dex" "$build/classes.jar"
"$sdk/aapt" package -f -M "$base/AndroidManifest.xml" -I "$android" -F "$build/raw.apk"
(cd "$build/dex" && zip -q "$build/raw.apk" classes.dex)
"$sdk/zipalign" -f 4 "$build/raw.apk" "$build/aligned.apk"
keytool -genkeypair -keystore "$build/fixture.jks" -storepass ephemeral -keypass ephemeral -alias fixture -keyalg RSA -keysize 2048 -validity 7 -dname CN=EphemeralAndroidTestHost >/dev/null
"$sdk/apksigner" sign --ks "$build/fixture.jks" --ks-pass pass:ephemeral --ks-key-alias fixture --out "$1" "$build/aligned.apk"
