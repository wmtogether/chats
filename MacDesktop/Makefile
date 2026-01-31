# Makefile for Workspace macOS Desktop Application

# Variables
APP_NAME = WorkspaceMac
BUILD_DIR = .build
RELEASE_DIR = $(BUILD_DIR)/release
DEBUG_DIR = $(BUILD_DIR)/debug
BUNDLE_DIR = $(APP_NAME).app
CONTENTS_DIR = $(BUNDLE_DIR)/Contents
MACOS_DIR = $(CONTENTS_DIR)/MacOS
RESOURCES_DIR = $(CONTENTS_DIR)/Resources

# Default target
.PHONY: all
all: debug

# Debug build
.PHONY: debug
debug:
	@echo "🔨 Building debug version..."
	swift build -c debug
	@echo "✅ Debug build complete"

# Release build
.PHONY: release
release:
	@echo "🔨 Building release version..."
	swift build -c release
	@echo "✅ Release build complete"

# Run debug version
.PHONY: run
run: debug
	@echo "🚀 Running debug version..."
	$(DEBUG_DIR)/$(APP_NAME)

# Run release version
.PHONY: run-release
run-release: release
	@echo "🚀 Running release version..."
	$(RELEASE_DIR)/$(APP_NAME)

# Convert icon from PNG to ICNS
.PHONY: convert-icon
convert-icon:
	@echo "🎨 Converting icon from PNG to ICNS..."
	@if [ -f "scripts/convert-icon.sh" ]; then \
		chmod +x scripts/convert-icon.sh; \
		./scripts/convert-icon.sh; \
	elif [ -f "scripts/convert-icon.py" ]; then \
		python3 scripts/convert-icon.py; \
	else \
		echo "❌ No icon conversion script found"; \
		exit 1; \
	fi

# Build frontend and create bundle
.PHONY: bundle-with-frontend
bundle-with-frontend: convert-icon
	@echo "🔨 Building frontend first..."
	@cd .. && if command -v bun >/dev/null 2>&1; then \
		echo "Using bun to build frontend..."; \
		bun run build; \
	elif command -v npm >/dev/null 2>&1; then \
		echo "Using npm to build frontend..."; \
		npm run build; \
	else \
		echo "❌ Neither bun nor npm found. Please install one of them."; \
		exit 1; \
	fi
	@echo "✅ Frontend build complete"
	@$(MAKE) bundle

# Create macOS app bundle
.PHONY: bundle
bundle: release
	@echo "📦 Creating macOS app bundle..."
	rm -rf $(BUNDLE_DIR)
	mkdir -p $(MACOS_DIR)
	mkdir -p $(RESOURCES_DIR)
	
	# Copy executable
	cp $(RELEASE_DIR)/$(APP_NAME) $(MACOS_DIR)/
	
	# Copy Distribution resources (embedded HTML/CSS/JS) into app bundle
	@if [ -d "../Distribution" ]; then \
		echo "📦 Embedding Distribution resources into app bundle..."; \
		cp -R ../Distribution/* $(RESOURCES_DIR)/; \
		echo "✅ Distribution resources embedded into app bundle"; \
	else \
		echo "⚠️  Distribution folder not found at ../Distribution"; \
		echo "⚠️  Run 'bun run build' or 'npm run build' first to create distribution files"; \
	fi
	
	# Create Info.plist
	@echo "📝 Creating Info.plist..."
	@cat > $(CONTENTS_DIR)/Info.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleExecutable</key>
	<string>$(APP_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>com.workspace.desktop</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>Workspace</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>LSMinimumSystemVersion</key>
	<string>11.0</string>
	<key>NSHighResolutionCapable</key>
	<true/>
	<key>NSSupportsAutomaticGraphicsSwitching</key>
	<true/>
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsArbitraryLoads</key>
		<true/>
		<key>NSAllowsLocalNetworking</key>
		<true/>
	</dict>
	<key>NSUserNotificationAlertStyle</key>
	<string>alert</string>
	<key>NSAppleEventsUsageDescription</key>
	<string>This app needs to send Apple Events to interact with other applications.</string>
	<key>NSDownloadsFolderUsageDescription</key>
	<string>This app needs access to the Downloads folder to save downloaded files.</string>
</dict>
</plist>
EOF
	
	# Copy icon if it exists
	@if [ -f "../Library/Shared/Icons/icon.icns" ]; then \
		echo "📎 Copying app icon..."; \
		cp ../Library/Shared/Icons/icon.icns $(RESOURCES_DIR)/AppIcon.icns; \
	else \
		echo "⚠️  No app icon found at ../Library/Shared/Icons/icon.icns"; \
	fi
	
	@echo "✅ App bundle created: $(BUNDLE_DIR)"

# Install app bundle to Applications folder
.PHONY: install
install: bundle
	@echo "📲 Installing to Applications folder..."
	rm -rf /Applications/$(BUNDLE_DIR)
	cp -R $(BUNDLE_DIR) /Applications/
	@echo "✅ Installed to /Applications/$(BUNDLE_DIR)"

# Clean build artifacts
.PHONY: clean
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf $(BUILD_DIR)
	rm -rf $(BUNDLE_DIR)
	@echo "✅ Clean complete"

# Development server (for frontend)
.PHONY: dev-server
dev-server:
	@echo "🌐 Starting development server..."
	@cd .. && bun run dev

# Show help
.PHONY: help
help:
	@echo "Workspace macOS Desktop Application"
	@echo ""
	@echo "Available targets:"
	@echo "  debug              - Build debug version"
	@echo "  release            - Build release version"
	@echo "  run                - Build and run debug version"
	@echo "  run-release        - Build and run release version"
	@echo "  convert-icon       - Convert PNG icon to ICNS format"
	@echo "  bundle             - Create macOS app bundle (.app)"
	@echo "  bundle-with-frontend - Build frontend and create app bundle"
	@echo "  install            - Install app bundle to Applications"
	@echo "  clean              - Clean build artifacts"
	@echo "  dev-server         - Start frontend development server"
	@echo "  help               - Show this help message"
	@echo ""
	@echo "Development workflow:"
	@echo "  1. make dev-server     (in one terminal)"
	@echo "  2. make run            (in another terminal)"
	@echo ""
	@echo "Production build:"
	@echo "  make bundle-with-frontend && make install"
	@echo ""
	@echo "Note: The bundle target requires Distribution/ folder with built frontend."
	@echo "      Use bundle-with-frontend to build frontend automatically."
	@echo "      Icon conversion requires Library/Shared/Icons/Content.png"