#!/usr/bin/env bash
set -euo pipefail

# 1. Build latest web bundle
npm run build

# 2. Extract version from package.json
VERSION=$(node -p "require('./package.json').version")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 3. Create OTA output directory
mkdir -p dist-ota

# 4. Zip the dist folder contents into bundle.zip
(cd dist && zip -r -q ../dist-ota/bundle.zip .)
CHECKSUM=$(shasum -a 256 dist-ota/bundle.zip | cut -d ' ' -f 1)

# 5. Generate version.json manifest
cat <<EOF > dist-ota/version.json
{
  "version": "${VERSION}",
  "bundleUrl": "https://api-anhvu0510.duckdns.org/api/app-update/bundle.zip",
  "checksum": "${CHECKSUM}",
  "releaseNotes": "Stories Reader cập nhật phiên bản ${VERSION}",
  "updatedAt": "${TIMESTAMP}"
}
EOF

# 6. Copy to local gateway public directory if present
GATEWAY_UPDATE_DIR="../gateway/services/www/public/app-update"
if [ -d "$GATEWAY_UPDATE_DIR" ]; then
  cp dist-ota/bundle.zip "$GATEWAY_UPDATE_DIR/bundle.zip"
  cp dist-ota/version.json "$GATEWAY_UPDATE_DIR/version.json"
  echo "✔ Synced OTA bundle & version.json to local gateway public folder"
fi

echo "✔ OTA bundle prepared successfully for version ${VERSION} in dist-ota/"
