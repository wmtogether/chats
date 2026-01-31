#!/usr/bin/env python3

"""
Icon conversion script for macOS
Converts PNG to ICNS format using Python and system tools
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def print_status(message):
    print(f"\033[0;34m[INFO]\033[0m {message}")

def print_success(message):
    print(f"\033[0;32m[SUCCESS]\033[0m {message}")

def print_warning(message):
    print(f"\033[1;33m[WARNING]\033[0m {message}")

def print_error(message):
    print(f"\033[0;31m[ERROR]\033[0m {message}")

def check_macos():
    """Check if running on macOS"""
    if sys.platform != "darwin":
        print_error("This script is designed for macOS only")
        return False
    return True

def check_dependencies():
    """Check if required tools are available"""
    tools = ["sips", "iconutil"]
    missing = []
    
    for tool in tools:
        if not shutil.which(tool):
            missing.append(tool)
    
    if missing:
        print_error(f"Missing required tools: {', '.join(missing)}")
        print_error("These tools should be available on all macOS systems")
        return False
    
    return True

def create_iconset(input_png, temp_dir):
    """Create iconset directory with all required sizes"""
    iconset_dir = temp_dir / "icon.iconset"
    iconset_dir.mkdir(parents=True, exist_ok=True)
    
    # Standard sizes for macOS app icons
    sizes = [
        (16, "icon_16x16.png"),
        (32, "icon_32x32.png"),
        (64, "icon_64x64.png"),
        (128, "icon_128x128.png"),
        (256, "icon_256x256.png"),
        (512, "icon_512x512.png"),
        (1024, "icon_1024x1024.png"),
    ]
    
    # Retina (@2x) versions
    retina_sizes = [
        (32, "icon_16x16@2x.png"),
        (64, "icon_32x32@2x.png"),
        (256, "icon_128x128@2x.png"),
        (512, "icon_256x256@2x.png"),
        (1024, "icon_512x512@2x.png"),
    ]
    
    all_sizes = sizes + retina_sizes
    
    for size, filename in all_sizes:
        output_path = iconset_dir / filename
        print_status(f"Generating {filename}...")
        
        try:
            subprocess.run([
                "sips", "-z", str(size), str(size), 
                str(input_png), "--out", str(output_path)
            ], check=True, capture_output=True)
        except subprocess.CalledProcessError as e:
            print_error(f"Failed to generate {filename}: {e}")
            return False
    
    return True

def convert_to_icns(iconset_dir, output_icns):
    """Convert iconset to ICNS format"""
    print_status("Converting iconset to ICNS...")
    
    try:
        subprocess.run([
            "iconutil", "-c", "icns", str(iconset_dir), "-o", str(output_icns)
        ], check=True, capture_output=True)
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"Failed to convert to ICNS: {e}")
        return False

def get_file_info(file_path):
    """Get file information"""
    try:
        stat = file_path.stat()
        size = stat.st_size
        
        # Try to get image info using sips
        result = subprocess.run([
            "sips", "-g", "pixelWidth", "-g", "pixelHeight", "-g", "format", str(file_path)
        ], capture_output=True, text=True)
        
        return f"{size} bytes", result.stdout if result.returncode == 0 else "Info unavailable"
    except Exception as e:
        return "Unknown size", f"Error getting info: {e}"

def main():
    print_status("Converting PNG icon to ICNS format for macOS")
    
    # Check system compatibility
    if not check_macos():
        sys.exit(1)
    
    if not check_dependencies():
        sys.exit(1)
    
    # Define paths
    script_dir = Path(__file__).parent
    input_png = script_dir.parent / "Library" / "Shared" / "Icons" / "Content.png"
    output_icns = script_dir.parent / "Library" / "Shared" / "Icons" / "icon.icns"
    temp_dir = script_dir / "temp_iconset"
    
    print_status(f"Input: {input_png}")
    print_status(f"Output: {output_icns}")
    
    # Check if input file exists
    if not input_png.exists():
        print_error(f"Input PNG file not found: {input_png}")
        sys.exit(1)
    
    # Create output directory if it doesn't exist
    output_icns.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        # Clean up any existing temp directory
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        
        # Create iconset
        if not create_iconset(input_png, temp_dir):
            sys.exit(1)
        
        # Convert to ICNS
        iconset_dir = temp_dir / "icon.iconset"
        if not convert_to_icns(iconset_dir, output_icns):
            sys.exit(1)
        
        # Verify output
        if output_icns.exists():
            file_size, file_info = get_file_info(output_icns)
            print_success("Icon conversion completed successfully!")
            print_success(f"Output file: {output_icns} ({file_size})")
            
            if "Error" not in file_info:
                print_status("Icon information:")
                print(file_info)
        else:
            print_error("Failed to create ICNS file")
            sys.exit(1)
    
    finally:
        # Clean up temporary files
        if temp_dir.exists():
            print_status("Cleaning up temporary files...")
            shutil.rmtree(temp_dir)
    
    print_success("✅ Icon conversion complete!")

if __name__ == "__main__":
    main()