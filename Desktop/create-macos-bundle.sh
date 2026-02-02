#!/bin/bash
#
# macOS App Bundle Creation Script (Workspace-safe)
# Usage:
#   ./create-macos-bundle.sh [target]
# Example:
#   ./create-macos-bundle.sh aarch64-apple-darwin
#

set -euo pipefail

# -------------------------------
# Resolve paths safely
# -------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# -------------------------------
# Config
# -------------------------------
TARGET="${1:-aarch64-apple-darwin}"

APP_NAME="MikoWorkspace"
EXECUTABLE_NAME="mikochat"
SERVICE_NAME="downloaderservice"

TARGET_DIR="${ROOT_DIR}/target/${TARGET}/release"
BUNDLE_PATH="${TARGET_DIR}/${APP_NAME}.app"

INFO_PLIST_SRC="${SCRIPT_DIR}/Info.plist"
ICON_ICNS="${ROOT_DIR}/Library/Shared/Icons/icon.icns"
ICON_PNG="${ROOT_DIR}/Library/Shared/Icons/icon.png"

echo "🍎 Creating macOS app bundle"
echo "   Target       : ${TARGET}"
echo "   Root dir     : ${ROOT_DIR}"
echo "   Target dir   : ${TARGET_DIR}"
echo "   Bundle path  : ${BUNDLE_PATH}"
echo

# -------------------------------
# Validate binaries
# -------------------------------
MIKO_BIN="${TARGET_DIR}/${EXECUTABLE_NAME}"
DL_BIN="${TARGET_DIR}/${SERVICE_NAME}"

if [[ ! -f "${MIKO_BIN}" ]]; then
  echo "❌ mikochat binary not found: ${MIKO_BIN}"
  exit 1
fi

if [[ ! -f "${DL_BIN}" ]]; then
  echo "❌ downloaderservice binary not found: ${DL_BIN}"
  exit 1
fi

echo "✅ Binaries found"

# -------------------------------
# Clean existing bundle
# -------------------------------
if [[ -d "${BUNDLE_PATH}" ]]; then
  echo "🧹 Removing existing bundle"
  rm -rf "${BUNDLE_PATH}"
fi

# -------------------------------
# Create bundle structure
# -------------------------------
echo "📁 Creating bundle structure"
mkdir -p "${BUNDLE_PATH}/Contents/MacOS"
mkdir -p "${BUNDLE_PATH}/Contents/Resources"

# -------------------------------
# Copy binaries
# -------------------------------
echo "📦 Copying binaries"
cp "${MIKO_BIN}" "${BUNDLE_PATH}/Contents/MacOS/"
cp "${DL_BIN}" "${BUNDLE_PATH}/Contents/MacOS/"

chmod +x \
  "${BUNDLE_PATH}/Contents/MacOS/${EXECUTABLE_NAME}" \
  "${BUNDLE_PATH}/Contents/MacOS/${SERVICE_NAME}"

# -------------------------------
# Info.plist
# -------------------------------
echo "📄 Handling Info.plist"
if [[ -f "${INFO_PLIST_SRC}" ]]; then
  cp "${INFO_PLIST_SRC}" "${BUNDLE_PATH}/Contents/Info.plist"
  echo "✅ Info.plist copied"
else
  echo "⚠️ Info.plist not found, generating default"
  cat > "${BUNDLE_PATH}/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
 "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>${APP_NAME}</string>
  <key>CFBundleDisplayName</key>
  <string>Miko Workspace</string>
  <key>CFBundleIdentifier</key>
  <string>com.miko.workspace</string>
  <key>CFBundleExecutable</key>
  <string>${EXECUTABLE_NAME}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.15</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
EOF
fi

# -------------------------------
# Icon
# -------------------------------
echo "🎨 Handling icon"
if [[ -f "${ICON_ICNS}" ]]; then
  cp "${ICON_ICNS}" "${BUNDLE_PATH}/Contents/Resources/icon.icns"
  echo "✅ icon.icns copied"
elif [[ -f "${ICON_PNG}" ]] && command -v iconutil &>/dev/null; then
  echo "🔄 Converting PNG → ICNS"
  TMP_ICONSET="$(mktemp -d)"
  mkdir -p "${TMP_ICONSET}/icon.iconset"
  cp "${ICON_PNG}" "${TMP_ICONSET}/icon.iconset/icon_512x512.png"
  iconutil -c icns "${TMP_ICONSET}/icon.iconset" \
    -o "${BUNDLE_PATH}/Contents/Resources/icon.icns"
  rm -rf "${TMP_ICONSET}"
else
  echo "⚠️ No icon available, using default"
fi

# -------------------------------
# Permissions
# -------------------------------
echo "🔐 Setting permissions"
chmod -R 755 "${BUNDLE_PATH}"

# -------------------------------
# Verify bundle
# -------------------------------
echo "🔍 Verifying bundle"
if [[
  -f "${BUNDLE_PATH}/Contents/Info.plist" &&
  -f "${BUNDLE_PATH}/Contents/MacOS/${EXECUTABLE_NAME}"
]]; then
  echo "✅ macOS app bundle created successfully"
  echo
  echo "📦 Bundle contents:"
  find "${BUNDLE_PATH}" -type f | sed "s|${ROOT_DIR}/||"
else
  echo "❌ Bundle verification failed"
  exit 1
fi

echo
echo "🎉 Done!"
