# Makefile for Workspace Desktop Application (Cross-Platform)

# Variables
APP_NAME = Workspace
EXECUTABLE_NAME_MAC = mikochat-mac
EXECUTABLE_NAME_WIN = mikochat
BUNDLE_NAME = Workspace.app
BUILD_DIR = .build
RELEASE_DIR = $(BUILD_DIR)/release
DEBUG_DIR = $(BUILD_DIR)/debug

# Colors for output
BLUE = \033[0;34m
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

# Detect OS
UNAME_S := $(shell uname -s)

# Default target
.PHONY: all
all: build

# Build for current platform
.PHONY: build
build:
ifeq ($(UNAME_S),Darwin)
	@echo "$(BLUE)[INFO]$(NC) Building for macOS..."
	cargo build --release --bin $(EXECUTABLE_NAME_MAC)
	@echo "$(GREEN)[SUCCESS]$(NC) macOS build complete"
else
	@echo "$(BLUE)[INFO]$(NC) Building for Windows/Linux..."
	cargo build --release --bin $(EXECUTABLE_NAME_WIN)
	@echo "$(GREEN)[SUCCESS]$(NC) Build complete"
endif

# Debug build
.PHONY: debug
debug:
ifeq ($(UNAME_S),Darwin)
	@echo "$(BLUE)[INFO]$(NC) Building debug for macOS..."
	cargo build --bin $(EXECUTABLE_NAME_MAC)
	@echo "$(GREEN)[SUCCESS]$(NC) macOS debug build complete"
else
	@echo "$(BLUE)[INFO]$(NC) Building debug for Windows/Linux..."
	cargo build --bin $(EXECUTABLE_NAME_WIN)
	@echo "$(GREEN)[SUCCESS]$(NC) Debug build complete"
endif

# Run application
.PHONY: run
run: debug
ifeq ($(UNAME_S),Darwin)
	@echo "$(BLUE)[INFO]$(NC) Running macOS version..."
	$(DEBUG_DIR)/$(EXECUTABLE_NAME_MAC)
else
	@echo "$(BLUE)[INFO]$(NC) Running Windows/Linux version..."
	$(DEBUG_DIR)/$(EXECUTABLE_NAME_WIN)
endif

# Run release version
.PHONY: run-release
run-release: build
ifeq ($(UNAME_S),Darwin)
	@echo "$(BLUE)[INFO]$(NC) Running macOS release version..."
	$(RELEASE_DIR)/$(EXECUTABLE_NAME_MAC)
else
	@echo "$(BLUE)[INFO]$(NC) Running Windows/Linux release version..."
	$(RELEASE_DIR)/$(EXECUTABLE_NAME_WIN)
endif

# Create macOS bundle
.PHONY: bundle
bundle:
ifeq ($(UNAME_S),Darwin)
	@echo "$(BLUE)[INFO]$(NC) Creating macOS .app bundle..."
	./create-macos-bundle.sh
	@echo "$(GREEN)[SUCCESS]$(NC) macOS bundle created"
else
	@echo "$(YELLOW)[WARNING]$(NC) Bundle creation is only available on macOS"
endif

# Install macOS bundle to Applications
.PHONY: install
install: bundle
ifeq ($(UNAME_S),Darwin)
	@echo "$(BLUE)[INFO]$(NC) Installing to Applications folder..."
	rm -rf /Applications/$(BUNDLE_NAME)
	cp -R $(BUILD_DIR)/$(BUNDLE_NAME) /Applications/
	@echo "$(GREEN)[SUCCESS]$(NC) Installed to /Applications/$(BUNDLE_NAME)"
else
	@echo "$(YELLOW)[WARNING]$(NC) Installation is only available on macOS"
endif

# Build with frontend
.PHONY: bundle-with-frontend
bundle-with-frontend:
	@echo "$(BLUE)[INFO]$(NC) Building frontend first..."
	@cd .. && if command -v bun >/dev/null 2>&1; then \
		echo "$(BLUE)[INFO]$(NC) Using bun to build frontend..."; \
		bun run build; \
	elif command -v npm >/dev/null 2>&1; then \
		echo "$(BLUE)[INFO]$(NC) Using npm to build frontend..."; \
		npm run build; \
	else \
		echo "$(RED)[ERROR]$(NC) Neither bun nor npm found. Please install one of them."; \
		exit 1; \
	fi
	@echo "$(GREEN)[SUCCESS]$(NC) Frontend build complete"
	@$(MAKE) bundle

# Clean build artifacts
.PHONY: clean
clean:
	@echo "$(BLUE)[INFO]$(NC) Cleaning build artifacts..."
	rm -rf $(BUILD_DIR)
ifeq ($(UNAME_S),Darwin)
	rm -rf $(BUNDLE_NAME)
endif
	@echo "$(GREEN)[SUCCESS]$(NC) Clean complete"

# Clean all (including Distribution)
.PHONY: clean-all
clean-all: clean
	@echo "$(BLUE)[INFO]$(NC) Cleaning all artifacts including Distribution..."
	rm -rf ../Distribution
	@echo "$(GREEN)[SUCCESS]$(NC) Clean all complete"

# Development server (for frontend)
.PHONY: dev-server
dev-server:
	@echo "$(BLUE)[INFO]$(NC) Starting development server..."
	@cd .. && bun run dev

# Check dependencies
.PHONY: check-deps
check-deps:
	@echo "$(BLUE)[INFO]$(NC) Checking dependencies..."
	@echo "Rust version:"
	@rustc --version || echo "$(RED)[ERROR]$(NC) Rust not installed"
	@echo "Cargo version:"
	@cargo --version || echo "$(RED)[ERROR]$(NC) Cargo not installed"
ifeq ($(UNAME_S),Darwin)
	@echo "macOS version:"
	@sw_vers -productVersion
	@echo "Xcode tools:"
	@xcode-select --version || echo "$(YELLOW)[WARNING]$(NC) Xcode command line tools not installed"
endif
	@echo "Node.js/Bun:"
	@bun --version || npm --version || echo "$(YELLOW)[WARNING]$(NC) Neither bun nor npm found"

# Test the bundle (macOS only)
.PHONY: test-bundle
test-bundle: bundle
ifeq ($(UNAME_S),Darwin)
	@echo "$(BLUE)[INFO]$(NC) Testing macOS bundle..."
	@if [ -f "$(BUILD_DIR)/$(BUNDLE_NAME)/Contents/MacOS/$(EXECUTABLE_NAME_MAC)" ]; then \
		echo "$(GREEN)[SUCCESS]$(NC) Bundle executable found"; \
		echo "$(BLUE)[INFO]$(NC) Bundle structure:"; \
		find "$(BUILD_DIR)/$(BUNDLE_NAME)" -type f | head -10; \
	else \
		echo "$(RED)[ERROR]$(NC) Bundle executable not found"; \
		exit 1; \
	fi
else
	@echo "$(YELLOW)[WARNING]$(NC) Bundle testing is only available on macOS"
endif

# Show help
.PHONY: help
help:
	@echo "$(BLUE)Workspace Desktop Application - Cross-Platform Build System$(NC)"
	@echo ""
	@echo "$(GREEN)Build Targets:$(NC)"
	@echo "  build              - Build release version for current platform"
	@echo "  debug              - Build debug version for current platform"
	@echo "  clean              - Clean build artifacts"
	@echo "  clean-all          - Clean all artifacts including Distribution"
	@echo ""
	@echo "$(GREEN)Run Targets:$(NC)"
	@echo "  run                - Build and run debug version"
	@echo "  run-release        - Build and run release version"
	@echo ""
	@echo "$(GREEN)macOS Bundle Targets:$(NC)"
	@echo "  bundle             - Create macOS .app bundle (macOS only)"
	@echo "  bundle-with-frontend - Build frontend and create bundle (macOS only)"
	@echo "  install            - Install bundle to Applications (macOS only)"
	@echo "  test-bundle        - Test bundle structure (macOS only)"
	@echo ""
	@echo "$(GREEN)Utility Targets:$(NC)"
	@echo "  dev-server         - Start frontend development server"
	@echo "  check-deps         - Check system dependencies"
	@echo "  help               - Show this help message"
	@echo ""
	@echo "$(YELLOW)Platform-Specific Notes:$(NC)"
ifeq ($(UNAME_S),Darwin)
	@echo "  Current platform: macOS"
	@echo "  Bundle creation: Available"
	@echo "  Executable: $(EXECUTABLE_NAME_MAC)"
	@echo "  Icon: ../Library/Shared/Icons/icon.icns"
else
	@echo "  Current platform: $(UNAME_S)"
	@echo "  Bundle creation: Not available (macOS only)"
	@echo "  Executable: $(EXECUTABLE_NAME_WIN)"
endif
	@echo ""
	@echo "$(YELLOW)Quick Start:$(NC)"
	@echo "  Development: make dev-server (terminal 1) && make run (terminal 2)"
	@echo "  Production:  make bundle-with-frontend && make install"