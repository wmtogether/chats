# Post-Build Script Updates

**Date**: February 10, 2026  
**Status**: ✅ COMPLETED

## Changes Made

### Updated: `Library/Shared/Scripts/postbuild.ts`

Added automatic copying of `downloaderservice.exe` to the distribution package.

## What Was Added

### 1. Copy downloaderservice.exe
```typescript
// Copy downloaderservice.exe
const downloaderSrc = join(TARGET_RELEASE_DIR, 'downloaderservice.exe');
const downloaderDest = join(DISTRIBUTION_PACKAGE_DIR, 'downloaderservice.exe');
const downloaderCopied = copyFile(downloaderSrc, downloaderDest, 'downloaderservice.exe');
```

### 2. Updated Summary Output
```typescript
console.log('\n📊 Post-build summary:');
console.log(`   workspace.exe: ${workspaceCopied ? '✅' : '❌'}`);
console.log(`   downloaderservice.exe: ${downloaderCopied ? '✅' : '❌'}`);
console.log(`   WebView2 runtime: ${existsSync(RUNTIME_DIR) ? '✅' : '❌'}`);
```

## Build Process

### 1. Build Rust Binaries
```bash
cargo build --release
```

This builds:
- `target/release/workspace.exe` - Main application
- `target/release/downloaderservice.exe` - Download service

### 2. Run Post-Build Script
```bash
bun run Library/Shared/Scripts/postbuild.ts
```

This script:
1. ✅ Downloads WebView2 runtime (if not present)
2. ✅ Copies `workspace.exe` to `Distribution/Package/`
3. ✅ Copies `downloaderservice.exe` to `Distribution/Package/`
4. ✅ Copies WebView2 runtime to `Distribution/Package/`

### 3. Build Installer (Optional)
```bash
iscc Library/Resources/build.iss
```

Creates: `Distribution/WorkspaceSetup.exe`

## Distribution Package Structure

After running the post-build script:

```
Distribution/Package/
├── workspace.exe                    ← Main application
├── downloaderservice.exe            ← Download service (NEW)
├── msedgewebview2.exe              ← WebView2 runtime
├── msedge.dll
├── msedge_100_percent.pak
├── msedge_200_percent.pak
├── resources.pak
├── icudtl.dat
├── v8_context_snapshot.bin
├── Locales/
│   ├── en-US.pak
│   ├── th-th.pak
│   └── ...
└── ... (other WebView2 files)
```

## Installer Behavior

The Inno Setup script (`Library/Resources/build.iss`) automatically:
- ✅ Copies all files from `Distribution/Package/` recursively
- ✅ Includes `downloaderservice.exe` in the installer
- ✅ Installs to `%LOCALAPPDATA%\Miko\Workspace`
- ✅ Creates desktop shortcut (optional)
- ✅ Handles upgrades automatically

## Runtime Behavior

When `workspace.exe` runs:
1. Looks for `downloaderservice.exe` in the same directory
2. Spawns it as a subprocess when download is requested
3. Reads progress from subprocess stdout
4. Updates UI in real-time

## File Locations

### Development
- Source: `Desktop/service/downloader/main.rs`
- Build output: `target/release/downloaderservice.exe`

### Distribution
- Package: `Distribution/Package/downloaderservice.exe`
- Installer: Embedded in `Distribution/WorkspaceSetup.exe`

### Installation
- Installed to: `%LOCALAPPDATA%\Miko\Workspace\downloaderservice.exe`
- Runtime lookup: Same directory as `workspace.exe`

## Verification

### Check Build Output
```bash
# After cargo build --release
ls target/release/downloaderservice.exe
```

### Check Distribution Package
```bash
# After running postbuild script
ls Distribution/Package/downloaderservice.exe
```

### Check Installed Application
```bash
# After running installer
ls "%LOCALAPPDATA%\Miko\Workspace\downloaderservice.exe"
```

## Testing

### 1. Build Everything
```bash
# Build Rust binaries
cargo build --release

# Run post-build script
bun run Library/Shared/Scripts/postbuild.ts

# Build installer
iscc Library/Resources/build.iss
```

### 2. Verify Files
```bash
# Check distribution package
dir Distribution\Package\*.exe

# Should show:
# workspace.exe
# downloaderservice.exe
# msedgewebview2.exe
```

### 3. Test Installer
```bash
# Run the installer
Distribution\WorkspaceSetup.exe

# After installation, check:
dir "%LOCALAPPDATA%\Miko\Workspace\*.exe"
```

### 4. Test Download Functionality
1. Launch the installed application
2. Start a download
3. Verify progress updates in real-time
4. Check console for subprocess logs

## Troubleshooting

### downloaderservice.exe Not Found
**Symptom**: Downloads fail with "executable not found"

**Solutions**:
1. Rebuild: `cargo build --release`
2. Re-run postbuild: `bun run Library/Shared/Scripts/postbuild.ts`
3. Check `target/release/` for the file
4. Verify it's copied to `Distribution/Package/`

### Installer Missing downloaderservice.exe
**Symptom**: Installed app doesn't have the downloader

**Solutions**:
1. Check `Distribution/Package/` has the file
2. Rebuild installer: `iscc Library/Resources/build.iss`
3. Verify Inno Setup script includes all files

### Download Progress Not Working
**Symptom**: Downloads start but no progress shown

**Solutions**:
1. Check `downloaderservice.exe` is in the same directory as `workspace.exe`
2. Verify subprocess spawns successfully (check logs)
3. Check console for progress JSON output
4. Verify `window.downloadProgressCallback` is defined

## Related Files

- `Library/Shared/Scripts/postbuild.ts` - Post-build script
- `Library/Resources/build.iss` - Inno Setup installer script
- `Desktop/service/downloader/main.rs` - Download service source
- `Desktop/src/main_win.rs` - Main app (spawns downloader)
- `Source/Library/hooks/useDownload.tsx` - Frontend download hook

## CI/CD Integration

The GitHub Actions workflow should:
1. Build both executables: `cargo build --release`
2. Run post-build script: `bun run Library/Shared/Scripts/postbuild.ts`
3. Build installer: `iscc Library/Resources/build.iss`
4. Upload `WorkspaceSetup.exe` as artifact

## Success Criteria

✅ `downloaderservice.exe` builds successfully  
✅ Post-build script copies it to `Distribution/Package/`  
✅ Installer includes it in the package  
✅ Installed app has the file in the correct location  
✅ Downloads work with real-time progress  
✅ No "file not found" errors  

## Status: COMPLETED ✅

The post-build script now automatically includes `downloaderservice.exe` in the distribution package and installer.
