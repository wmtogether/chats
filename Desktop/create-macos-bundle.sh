#!/bin/bash

# macOS App Bundle Creation Script
# Usage: ./create-macos-bundle.sh [target]
# Example: ./create-macos-bundle.sh aarch64-apple-darwin

set -e

TARGET=${1:-"aarch64-apple-darwin"}
APP_NAME="MikoWorkspace"
BUNDLE_NAME="${APP_NAME}.app"
BUNDLE_PATH="target/${TARGET}/release/${BUNDLE_NAME}"

echo "🍎 Creating macOS app bundle for target: ${TARGET}"

# Clean up any existing bundle
if [ -d "${BUNDLE_PATH}" ]; then
    echo "🧹 Removing existing bundle..."
    rm -rf "${BUNDLE_PATH}"
fi

# Create bundle directory structure
echo "📁 Creating bundle structure..."
mkdir -p "${BUNDLE_PATH}/Contents/MacOS"
mkdir -p "${BUNDLE_PATH}/Contents/Resources"

# Copy binaries
echo "📦 Copying binaries..."
if [ -f "target/${TARGET}/release/mikochat" ]; then
    cp "target/${TARGET}/release/mikochat" "${BUNDLE_PATH}/Contents/MacOS/"
    chmod +x "${BUNDLE_PATH}/Contents/MacOS/mikochat"
    echo "✅ mikochat binary copied"
else
    echo "❌ mikochat binary not found at target/${TARGET}/release/mikochat"
    exit 1
fi

if [ -f "target/${TARGET}/release/downloaderservice" ]; then
    cp "target/${TARGET}/release/downloaderservice" "${BUNDLE_PATH}/Contents/MacOS/"
    chmod +x "${BUNDLE_PATH}/Contents/MacOS/downloaderservice"
    echo "✅ downloaderservice binary copied"
else
    echo "❌ downloaderservice binary not found at target/${TARGET}/release/downloaderservice"
    exit 1
fi

# Copy Info.plist
echo "📄 Copying Info.plist..."
if [ -f "Info.plist" ]; then
    cp "Info.plist" "${BUNDLE_PATH}/Contents/"
    echo "✅ Info.plist copied"
else
    echo "⚠️ Info.plist not found, creating default..."
    cat > "${BUNDLE_PATH}/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>Miko Workspace</string>
    <key>CFBundleExecutable</key>
    <string>mikochat</string>
    <key>CFBundleIconFile</key>
    <string>icon</string>
    <key>CFBundleIdentifier</key>
    <string>com.miko.workspace</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>MikoWorkspace</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
</dict>
</plist>
EOF
    echo "✅ Default Info.plist created"
fi

# Copy icon if available
echo "🎨 Copying icon..."
if [ -f "../Library/Shared/Icons/icon.icns" ]; then
    cp "../Library/Shared/Icons/icon.icns" "${BUNDLE_PATH}/Contents/Resources/"
    echo "✅ Icon copied"
elif [ -f "../Library/Shared/Icons/icon.png" ]; then
    # Convert PNG to ICNS if needed (requires iconutil)
    if command -v iconutil &> /dev/null; then
        echo "🔄 Converting PNG to ICNS..."
        mkdir -p "icon.iconset"
        cp "../Library/Shared/Icons/icon.png" "icon.iconset/icon_512x512.png"
        iconutil -c icns "icon.iconset" -o "${BUNDLE_PATH}/Contents/Resources/icon.icns"
        rm -rf "icon.iconset"
        echo "✅ Icon converted and copied"
    else
        echo "⚠️ iconutil not available, copying PNG as fallback"
        cp "../Library/Shared/Icons/icon.png" "${BUNDLE_PATH}/Contents/Resources/"
    fi
else
    echo "⚠️ No icon found, bundle will use default icon"
fi

# Set proper permissions
echo "🔐 Setting permissions..."
chmod -R 755 "${BUNDLE_PATH}"
chmod +x "${BUNDLE_PATH}/Contents/MacOS/"*

# Verify bundle structure
echo "🔍 Verifying bundle structure..."
if [ -d "${BUNDLE_PATH}" ] && [ -f "${BUNDLE_PATH}/Contents/Info.plist" ] && [ -f "${BUNDLE_PATH}/Contents/MacOS/mikochat" ]; then
    echo "✅ macOS app bundle created successfully at: ${BUNDLE_PATH}"
    echo "📊 Bundle contents:"
    find "${BUNDLE_PATH}" -type f | sort
else
    echo "❌ Bundle creation failed"
    exit 1
fi

echo "🎉 macOS app bundle creation completed!"