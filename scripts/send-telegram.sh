#!/usr/bin/env bash
set -euo pipefail

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-5379136611:AAFvX2godRHlok9qzbU9ROxA0JJruumAlps}"
CHAT_ID="${TELEGRAM_CHAT_ID:-898218742}"
VERSION=$(node -p "require('./package.json').version || '1.0.0'")
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"

if [ ! -f "$APK_PATH" ]; then
	APK_PATH="android/release-output/StoriesReader-v${VERSION}.apk"
fi

if [ ! -f "$APK_PATH" ]; then
	echo "❌ Error: APK not found at $APK_PATH"
	exit 1
fi

echo "📤 Đang gửi file APK sang Telegram (Chat ID: ${CHAT_ID})..."
curl -s -F "chat_id=${CHAT_ID}" \
	-F "document=@${APK_PATH};filename=StoriesReader-v${VERSION}.apk" \
	-F "caption=📱 *Stories Reader v${VERSION}*
🚀 *Build APK thành công!*
⚡ Nhấn vào file đính kèm để cài đặt trực tiếp trên điện thoại Android." \
	-F "parse_mode=Markdown" \
	"https://api.telegram.org/bot${BOT_TOKEN}/sendDocument" > /dev/null

echo "✔ Đã gửi APK thành công sang Telegram!"
