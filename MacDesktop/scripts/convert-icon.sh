#!/bin/bash

# Icon conversion script for macOS
# Converts PNG to ICNS format for macOS app bundles

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

# Input and output paths
INPUT_PNG="../Library/Shared/Icons/Content.png"
OUTPUT_ICNS="../Library/Shared/Icons/icon.icns"
TEMP_DIR="./temp_iconset"

print_status "Converting PNG icon to ICNS format for macOS"
print_status "Input: $INPUT_PNG"
print_status "Output: $OUTPUT_ICNS"

# Check if input file exists
if [ ! -f "$INPUT_PNG" ]; then
    print_error "Input PNG file not found: $INPUT_PNG"
    exit 1
fi

# Check if sips command is available (built into macOS)
if ! command -v sips &> /dev/null; then
    print_error "sips command not found. This should be available on all macOS systems."
    exit 1
fi

# Create temporary iconset directory
print_status "Creating temporary iconset directory..."
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR/icon.iconset"

# Generate all required icon sizes for macOS
print_status "Generating icon sizes..."

# Standard sizes for macOS app icons
declare -a sizes=(
    "16x16"
    "32x32" 
    "64x64"
    "128x128"
    "256x256"
    "512x512"
    "1024x1024"
)

# Generate @1x versions
for size in "${sizes[@]}"; do
    filename="icon_${size}.png"
    print_status "Generating $filename..."
    sips -z ${size/x/ } "$INPUT_PNG" --out "$TEMP_DIR/icon.iconset/$filename" > /dev/null 2>&1
done

# Generate @2x versions (Retina)
declare -a retina_sizes=(
    "32x32:16x16@2x"
    "64x64:32x32@2x"
    "256x256:128x128@2x"
    "512x512:256x256@2x"
    "1024x1024:512x512@2x"
)

for size_mapping in "${retina_sizes[@]}"; do
    source_size="${size_mapping%%:*}"
    target_name="${size_mapping##*:}"
    filename="icon_${target_name}.png"
    print_status "Generating $filename..."
    sips -z ${source_size/x/ } "$INPUT_PNG" --out "$TEMP_DIR/icon.iconset/$filename" > /dev/null 2>&1
done

# Convert iconset to icns
print_status "Converting iconset to ICNS..."
iconutil -c icns "$TEMP_DIR/icon.iconset" -o "$OUTPUT_ICNS"

# Clean up temporary files
print_status "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

# Verify the output file was created
if [ -f "$OUTPUT_ICNS" ]; then
    file_size=$(stat -f%z "$OUTPUT_ICNS" 2>/dev/null || echo "unknown")
    print_success "Icon conversion completed successfully!"
    print_success "Output file: $OUTPUT_ICNS (${file_size} bytes)"
    
    # Show icon info
    print_status "Icon information:"
    sips -g pixelWidth -g pixelHeight -g format "$OUTPUT_ICNS" 2>/dev/null || true
else
    print_error "Failed to create ICNS file"
    exit 1
fi

print_success "✅ Icon conversion complete!"