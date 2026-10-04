#!/usr/bin/env bash
set -euo pipefail

# Tự động nhận diện JDK 21 và Android SDK nếu chưa có trong biến môi trường
if [ -z "${JAVA_HOME:-}" ]; then
  if [ -d "$HOME/.jdks/jdk-21.0.12.1+1/Contents/Home" ]; then
    export JAVA_HOME="$HOME/.jdks/jdk-21.0.12.1+1/Contents/Home"
  fi
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  if [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  fi
fi

echo "🚀 Bắt đầu build Stories Reader Android APK..."
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
echo "✔ Build APK thành công: android/app/build/outputs/apk/debug/app-debug.apk"
