#!/bin/bash

# Workspace macOS Desktop Application Build Script

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if Swift is installed
if ! command -v swift &> /dev/null; then
    print_error "Swift is not installed. Please install Xcode or Swift toolchain."
    exit 1
fi

# Check Swift version
SWIFT_VERSION=$(swift --version | head -n1)
print_status "Using $SWIFT_VERSION"

# Function to show help
show_help() {
    echo "Workspace macOS Desktop Application Build Script"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  debug       Build debug version (default)"
    echo "  release     Build release version"
    echo "  run         Build and run debug version"
    echo "  run-release Build and run release version"
    echo "  bundle      Create macOS app bundle"
    echo "  install     Install app bundle to Applications"
    echo "  clean       Clean build artifacts"
    echo "  dev         Start development mode (frontend + app)"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 debug           # Build debug version"
    echo "  $0 run             # Build and run debug"
    echo "  $0 bundle          # Create .app bundle"
    echo "  $0 dev             # Start development mode"
}

# Function to check if frontend dev server is running
check_dev_server() {
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start development mode
start_dev_mode() {
    print_status "Starting development mode..."
    
    # Check if bun is available
    if command -v bun &> /dev/null; then
        print_status "Starting frontend development server with bun..."
        cd ..
        bun run dev &
        FRONTEND_PID=$!
        cd MacDesktop
    elif command -v npm &> /dev/null; then
        print_status "Starting frontend development server with npm..."
        cd ..
        npm run dev &
        FRONTEND_PID=$!
        cd MacDesktop
    else
        print_error "Neither bun nor npm found. Please install one of them."
        exit 1
    fi
    
    # Wait for dev server to start
    print_status "Waiting for development server to start..."
    for i in {1..30}; do
        if check_dev_server; then
            print_success "Development server is running at http://localhost:5173"
            break
        fi
        sleep 1
        if [ $i -eq 30 ]; then
            print_error "Development server failed to start"
            kill $FRONTEND_PID 2>/dev/null || true
            exit 1
        fi
    done
    
    # Build and run the app
    print_status "Building and running macOS app..."
    swift build -c debug
    
    print_success "Starting Workspace macOS app..."
    print_status "Press Ctrl+C to stop both frontend and app"
    
    # Trap Ctrl+C to clean up
    trap 'print_status "Stopping development mode..."; kill $FRONTEND_PID 2>/dev/null || true; exit 0' INT
    
    # Run the app
    .build/debug/WorkspaceMac
    
    # Clean up
    kill $FRONTEND_PID 2>/dev/null || true
}

# Main script logic
case "${1:-debug}" in
    "debug")
        print_status "Building debug version..."
        swift build -c debug
        print_success "Debug build complete: .build/debug/WorkspaceMac"
        ;;
    
    "release")
        print_status "Building release version..."
        swift build -c release
        print_success "Release build complete: .build/release/WorkspaceMac"
        ;;
    
    "run")
        print_status "Building and running debug version..."
        swift build -c debug
        print_success "Starting Workspace macOS app (debug)..."
        .build/debug/WorkspaceMac
        ;;
    
    "run-release")
        print_status "Building and running release version..."
        swift build -c release
        print_success "Starting Workspace macOS app (release)..."
        .build/release/WorkspaceMac
        ;;
    
    "bundle")
        print_status "Creating macOS app bundle..."
        make bundle
        print_success "App bundle created: WorkspaceMac.app"
        ;;
    
    "install")
        print_status "Installing app bundle to Applications..."
        make install
        print_success "Installed to /Applications/WorkspaceMac.app"
        ;;
    
    "clean")
        print_status "Cleaning build artifacts..."
        rm -rf .build
        rm -rf WorkspaceMac.app
        print_success "Clean complete"
        ;;
    
    "dev")
        start_dev_mode
        ;;
    
    "help"|"-h"|"--help")
        show_help
        ;;
    
    *)
        print_error "Unknown option: $1"
        echo ""
        show_help
        exit 1
        ;;
esac