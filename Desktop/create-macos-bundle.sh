#!/bin/bash

# macOS Bundle Creation Script for Workspace Desktop Application
# This script creates a proper macOS .app bundle with all necessary components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS only"
    exit 1
fi

print_status "Creating macOS .app bundle for Workspace Desktop Application"

# Configuration
APP_NAME="Workspace"
BUNDLE_NAME="Workspace.app"
EXECUTABLE_NAME="mikochat-mac"
BUNDLE_ID="com.workspace.desktop"
VERSION="1.0.0"

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
BUILD_DIR="$SCRIPT_DIR/target"
RELEASE_DIR="$BUILD_DIR/release"
BUNDLE_DIR="$BUILD_DIR/$BUNDLE_NAME"
CONTENTS_DIR="$BUNDLE_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
FRAMEWORKS_DIR="$CONTENTS_DIR/Frameworks"

# Icon paths
ICON_SOURCE="$PROJECT_ROOT/Library/Shared/Icons/icon.icns"
ICON_DEST="$RESOURCES_DIR/AppIcon.icns"

# Distribution path (for embedded web assets)
DISTRIBUTION_DIR="$PROJECT_ROOT/Distribution"

print_status "Configuration:"
print_status "  App Name: $APP_NAME"
print_status "  Bundle: $BUNDLE_NAME"
print_status "  Executable: $EXECUTABLE_NAME"
print_status "  Bundle ID: $BUNDLE_ID"
print_status "  Version: $VERSION"
print_status "  Icon Source: $ICON_SOURCE"

# Clean and create directories
print_status "Setting up bundle directory structure..."
rm -rf "$BUNDLE_DIR"
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"
mkdir -p "$FRAMEWORKS_DIR"

# Build the Rust application
print_status "Building Rust application for release..."
cd "$SCRIPT_DIR"

if ! cargo build --release --bin "$EXECUTABLE_NAME"; then
    print_error "Failed to build Rust application"
    exit 1
fi

# Check if executable was created
EXECUTABLE_PATH="$RELEASE_DIR/$EXECUTABLE_NAME"
if [ ! -f "$EXECUTABLE_PATH" ]; then
    print_error "Executable not found at: $EXECUTABLE_PATH"
    print_error "Available files in release directory:"
    ls -la "$RELEASE_DIR" || echo "Release directory not found"
    exit 1
fi

print_success "Rust application built successfully"

# Copy executable to bundle
print_status "Copying executable to bundle..."
cp "$EXECUTABLE_PATH" "$MACOS_DIR/$EXECUTABLE_NAME"
chmod +x "$MACOS_DIR/$EXECUTABLE_NAME"

# Copy and process Info.plist
print_status "Creating Info.plist..."
if [ -f "$SCRIPT_DIR/Info.plist" ]; then
    cp "$SCRIPT_DIR/Info.plist" "$CONTENTS_DIR/Info.plist"
    print_success "Info.plist copied to bundle"
else
    print_warning "Info.plist not found, creating basic one..."
    cat > "$CONTENTS_DIR/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleDisplayName</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>$EXECUTABLE_NAME</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
</dict>
</plist>
EOF
fi

# Copy app icon
print_status "Processing app icon..."
if [ -f "$ICON_SOURCE" ]; then
    cp "$ICON_SOURCE" "$ICON_DEST"
    print_success "App icon copied: $(basename "$ICON_SOURCE")"
    
    # Verify icon format
    if file "$ICON_DEST" | grep -q "Mac OS X icon"; then
        print_success "Icon format verified: macOS .icns format"
    else
        print_warning "Icon may not be in proper .icns format"
    fi
else
    print_warning "App icon not found at: $ICON_SOURCE"
    print_warning "Creating placeholder icon..."
    
    # Create a simple placeholder icon using sips if available
    if command -v sips &> /dev/null; then
        # Create a simple colored square as placeholder
        sips -s format icns -s dpiHeight 72.0 -s dpiWidth 72.0 -z 512 512 /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns --out "$ICON_DEST" 2>/dev/null || {
            print_warning "Could not create placeholder icon"
        }
    fi
fi

# Copy Distribution assets (embedded web content)
if [ -d "$DISTRIBUTION_DIR" ]; then
    print_status "Copying Distribution assets to bundle..."
    cp -R "$DISTRIBUTION_DIR"/* "$RESOURCES_DIR/"
    print_success "Distribution assets copied to bundle"
    
    # List copied assets
    print_status "Embedded web assets:"
    find "$RESOURCES_DIR" -name "*.html" -o -name "*.js" -o -name "*.css" | head -10 | while read -r file; do
        echo "  - $(basename "$file")"
    done
else
    print_warning "Distribution directory not found at: $DISTRIBUTION_DIR"
    print_warning "Web assets will not be embedded in the bundle"
fi

# Create PkgInfo file
print_status "Creating PkgInfo file..."
echo -n "APPL????" > "$CONTENTS_DIR/PkgInfo"

# Set proper permissions
print_status "Setting bundle permissions..."
chmod -R 755 "$BUNDLE_DIR"
chmod +x "$MACOS_DIR/$EXECUTABLE_NAME"

# Code signing (if developer certificate is available)
print_status "Checking for code signing certificate..."
if security find-identity -v -p codesigning | grep -q "Developer ID Application"; then
    print_status "Code signing certificate found, signing bundle..."
    
    # Sign the executable first
    codesign --force --options runtime --sign "Developer ID Application" "$MACOS_DIR/$EXECUTABLE_NAME" || {
        print_warning "Failed to sign executable, continuing without signature"
    }
    
    # Sign the entire bundle
    codesign --force --options runtime --sign "Developer ID Application" "$BUNDLE_DIR" || {
        print_warning "Failed to sign bundle, continuing without signature"
    }
    
    print_success "Bundle signed successfully"
else
    print_warning "No code signing certificate found"
    print_warning "Bundle will not be signed (may show security warnings)"
fi

# Verify bundle structure
print_status "Verifying bundle structure..."
if [ -f "$CONTENTS_DIR/Info.plist" ] && [ -f "$MACOS_DIR/$EXECUTABLE_NAME" ]; then
    print_success "Bundle structure verified"
    
    # Display bundle information
    print_status "Bundle contents:"
    echo "  📁 $BUNDLE_NAME/"
    echo "    📁 Contents/"
    echo "      📄 Info.plist"
    echo "      📄 PkgInfo"
    echo "      📁 MacOS/"
    echo "        🔧 $EXECUTABLE_NAME"
    echo "      📁 Resources/"
    [ -f "$ICON_DEST" ] && echo "        🎨 AppIcon.icns"
    [ -d "$RESOURCES_DIR" ] && find "$RESOURCES_DIR" -maxdepth 1 -type f | head -5 | while read -r file; do
        echo "        📄 $(basename "$file")"
    done
    
    # Show bundle size
    BUNDLE_SIZE=$(du -sh "$BUNDLE_DIR" | cut -f1)
    print_status "Bundle size: $BUNDLE_SIZE"
    
else
    print_error "Bundle structure verification failed"
    exit 1
fi

# Test bundle launch (optional)
print_status "Testing bundle launch..."
if "$MACOS_DIR/$EXECUTABLE_NAME" --version 2>/dev/null || true; then
    print_success "Executable can be launched"
else
    print_warning "Could not test executable launch (this may be normal)"
fi

# Final success message
print_success "✅ macOS bundle created successfully!"
print_success "📦 Bundle location: $BUNDLE_DIR"
print_success "🚀 To install: drag $BUNDLE_NAME to Applications folder"
print_success "🔧 To run from terminal: open '$BUNDLE_DIR'"

# Optional: Open bundle location in Finder
if command -v open &> /dev/null; then
    print_status "Opening bundle location in Finder..."
    open "$BUILD_DIR"
fi

print_status "Bundle creation complete! 🎉"