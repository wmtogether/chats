# Makefile for Workspace Launcher (Native C)
# Build with: nmake

CC=cl
LINK=link
RC=rc

# Directories
BUILD_DIR=build
DIST_DIR=..\dist

# Compiler flags
CFLAGS=/nologo /W3 /O2 /MD /D_CRT_SECURE_NO_WARNINGS /DUNICODE /D_UNICODE
LDFLAGS=/nologo /SUBSYSTEM:WINDOWS /ENTRY:WinMainCRTStartup
LIBS=wininet.lib shell32.lib user32.lib kernel32.lib

# Icon resource
ICON_PATH=..\..\Library\Shared\Icons\icon.ico

# Build artifacts
OBJ_FILE=$(BUILD_DIR)\launcher.obj
RES_FILE=$(BUILD_DIR)\launcher.res
RC_FILE=$(BUILD_DIR)\launcher.rc
TARGET=$(BUILD_DIR)\launcher.exe

all: $(TARGET)

# Create build directory
$(BUILD_DIR):
	@if not exist "$(BUILD_DIR)" mkdir "$(BUILD_DIR)"

# Create resource file
$(RC_FILE): $(BUILD_DIR)
	@echo Creating launcher.rc...
	@echo IDI_ICON1 ICON "$(ICON_PATH)" > $(RC_FILE)

# Compile resource file
$(RES_FILE): $(RC_FILE)
	$(RC) /nologo /fo$(RES_FILE) $(RC_FILE)

# Compile C source
$(OBJ_FILE): launcher.c $(BUILD_DIR)
	$(CC) $(CFLAGS) /c /Fo$(OBJ_FILE) launcher.c

# Link executable
$(TARGET): $(OBJ_FILE) $(RES_FILE)
	$(LINK) $(LDFLAGS) /OUT:$(TARGET) $(OBJ_FILE) $(RES_FILE) $(LIBS)
	@echo.
	@echo Build complete: $(TARGET)

# Install to dist directory
install: $(TARGET)
	@if not exist "$(DIST_DIR)" mkdir "$(DIST_DIR)"
	copy /Y $(TARGET) "$(DIST_DIR)\launcher.exe"
	@echo Installed to $(DIST_DIR)

# Clean build artifacts
clean:
	@if exist "$(BUILD_DIR)" rmdir /S /Q "$(BUILD_DIR)"
	@echo Cleaned build directory

# Rebuild everything
rebuild: clean all

.PHONY: all install clean rebuild

