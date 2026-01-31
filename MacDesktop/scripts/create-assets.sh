#!/bin/bash

# Create Assets.car for embedded resources
# This script creates a proper macOS asset catalog for better resource embedding

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

# Check if actool is available (part of Xcode)
if ! command -v actool &> /dev/null; then
    print_error "actool not found. Please install Xcode or Xcode Command Line Tools."
    exit 1
fi

print_status "Creating Assets.car for embedded resources"

# Paths
ASSETS_DIR="./Assets.xcassets"
DISTRIBUTION_DIR="../Distribution"
OUTPUT_DIR="./build/Assets"
ASSETS_CAR="$OUTPUT_DIR/Assets.car"

# Clean up and create directories
rm -rf "$ASSETS_DIR" "$OUTPUT_DIR"
mkdir -p "$ASSETS_DIR" "$OUTPUT_DIR"

# Create AppIcon.appiconset if icon exists
if [ -f "../Library/Shared/Icons/icon.icns" ]; then
    print_status "Creating AppIcon asset set..."
    
    APPICON_DIR="$ASSETS_DIR/AppIcon.appiconset"
    mkdir -p "$APPICON_DIR"
    
    # Create Contents.json for AppIcon
    cat > "$APPICON_DIR/Contents.json" << 'EOF'
{
  "images" : [
    {
      "filename" : "icon_16x16.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "16x16"
    },
    {
      "filename" : "icon_16x16@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "16x16"
    },
    {
      "filename" : "icon_32x32.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "32x32"
    },
    {
      "filename" : "icon_32x32@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "32x32"
    },
    {
      "filename" : "icon_128x128.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "128x128"
    },
    {
      "filename" : "icon_128x128@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "128x128"
    },
    {
      "filename" : "icon_256x256.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "256x256"
    },
    {
      "filename" : "icon_256x256@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "256x256"
    },
    {
      "filename" : "icon_512x512.png",
      "idiom" : "mac",
      "scale" : "1x",
      "size" : "512x512"
    },
    {
      "filename" : "icon_512x512@2x.png",
      "idiom" : "mac",
      "scale" : "2x",
      "size" : "512x512"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF
    
    # Extract icon sizes from ICNS (if possible)
    if command -v sips &> /dev/null; then
        print_status "Extracting icon sizes from ICNS..."
        
        # Generate all required sizes
        declare -a sizes=(
            "16:icon_16x16.png"
            "32:icon_32x32.png"
            "64:icon_32x32@2x.png"
            "128:icon_128x128.png"
            "256:icon_256x256.png"
            "512:icon_512x512.png"
            "1024:icon_512x512@2x.png"
        )
        
        for size_mapping in "${sizes[@]}"; do
            size="${size_mapping%%:*}"
            filename="${size_mapping##*:}"
            
            sips -s format png -z $size $size "../Library/Shared/Icons/icon.icns" --out "$APPICON_DIR/$filename" > /dev/null 2>&1 || true
        done
        
        # Also create the missing @2x versions
        sips -s format png -z 32 32 "../Library/Shared/Icons/icon.icns" --out "$APPICON_DIR/icon_16x16@2x.png" > /dev/null 2>&1 || true
        sips -s format png -z 256 256 "../Library/Shared/Icons/icon.icns" --out "$APPICON_DIR/icon_128x128@2x.png" > /dev/null 2>&1 || true
        sips -s format png -z 512 512 "../Library/Shared/Icons/icon.icns" --out "$APPICON_DIR/icon_256x256@2x.png" > /dev/null 2>&1 || true
    fi
fi

# Create data sets for web resources if Distribution exists
if [ -d "$DISTRIBUTION_DIR" ]; then
    print_status "Creating data sets for web resources..."
    
    # Create a dataset for the main HTML file
    if [ -f "$DISTRIBUTION_DIR/index.html" ]; then
        HTML_DATASET="$ASSETS_DIR/IndexHTML.dataset"
        mkdir -p "$HTML_DATASET"
        
        cp "$DISTRIBUTION_DIR/index.html" "$HTML_DATASET/index.html"
        
        cat > "$HTML_DATASET/Contents.json" << 'EOF'
{
  "data" : [
    {
      "filename" : "index.html",
      "idiom" : "universal"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF
    fi
    
    # Create datasets for other common web assets
    find "$DISTRIBUTION_DIR" -name "*.js" -o -name "*.css" -o -name "*.png" -o -name "*.jpg" -o -name "*.svg" | head -20 | while read -r file; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            name_without_ext="${filename%.*}"
            ext="${filename##*.}"
            
            # Create a safe dataset name (alphanumeric only)
            safe_name=$(echo "$name_without_ext" | sed 's/[^a-zA-Z0-9]//g')
            if [ ${#safe_name} -gt 20 ]; then
                safe_name="${safe_name:0:20}"
            fi
            
            ASSET_DATASET="$ASSETS_DIR/${safe_name}Asset.dataset"
            mkdir -p "$ASSET_DATASET"
            
            cp "$file" "$ASSET_DATASET/$filename"
            
            cat > "$ASSET_DATASET/Contents.json" << EOF
{
  "data" : [
    {
      "filename" : "$filename",
      "idiom" : "universal"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF
        fi
    done
fi

# Create main Contents.json for the asset catalog
cat > "$ASSETS_DIR/Contents.json" << 'EOF'
{
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF

# Compile the asset catalog to Assets.car
print_status "Compiling asset catalog to Assets.car..."

actool \
    --output-format human-readable-text \
    --notices \
    --warnings \
    --platform macosx \
    --minimum-deployment-target 11.0 \
    --compile "$OUTPUT_DIR" \
    "$ASSETS_DIR"

if [ -f "$ASSETS_CAR" ]; then
    file_size=$(stat -f%z "$ASSETS_CAR" 2>/dev/null || echo "unknown")
    print_success "Assets.car created successfully!"
    print_success "Output: $ASSETS_CAR (${file_size} bytes)"
    
    # Show contents
    print_status "Asset catalog contents:"
    ls -la "$OUTPUT_DIR"
else
    print_error "Failed to create Assets.car"
    exit 1
fi

# Clean up temporary assets directory
rm -rf "$ASSETS_DIR"

print_success "✅ Asset catalog creation complete!"
print_status "Copy $ASSETS_CAR to your app bundle's Resources folder"