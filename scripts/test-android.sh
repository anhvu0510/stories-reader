#!/usr/bin/env bash
set -euo pipefail

# Tự động nạp JDK 21 và Android SDK nếu chưa có trong biến môi trường
if [ -z "${JAVA_HOME:-}" ] && [ -d "$HOME/.jdks/jdk-21.0.12.1+1/Contents/Home" ]; then
  export JAVA_HOME="$HOME/.jdks/jdk-21.0.12.1+1/Contents/Home"
fi

if [ -z "${ANDROID_HOME:-}" ] && [ -d "$HOME/Library/Android/sdk" ]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
fi

cd android
./gradlew test "$@"
