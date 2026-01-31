# Workspace macOS Desktop Application

A native macOS desktop application built with Swift and WebKit, providing the same functionality as the Windows version but optimized for macOS.

## Features

- **Native macOS Integration**: Built with Swift, Cocoa, and WebKit
- **File Downloads**: Direct download management with progress tracking
- **Finder Integration**: Show downloaded files in Finder
- **Notifications**: Native macOS notifications for download status
- **Menu Bar**: Full native menu bar with keyboard shortcuts
- **WebView**: Embedded WebKit view for the web application
- **Clipboard Support**: Enhanced clipboard access for macOS
- **Developer Tools**: Available in debug builds
- **Auto-scaling**: Supports Retina displays and zoom controls

## Requirements

- macOS 11.0 (Big Sur) or later
- Xcode 13.0 or later (for building)
- Swift 5.9 or later

## Building and Running

### Development Mode

1. **Start the frontend development server:**
   ```bash
   make dev-server
   ```

2. **In another terminal, build and run the app:**
   ```bash
   make run
   ```

The app will automatically connect to the development server at `http://localhost:5173`.

### Production Build

1. **Create a release build:**
   ```bash
   make release
   ```

2. **Create macOS app bundle:**
   ```bash
   make bundle
   ```

3. **Install to Applications folder:**
   ```bash
   make install
   ```

### Available Make Targets

- `make debug` - Build debug version
- `make release` - Build release version  
- `make run` - Build and run debug version
- `make run-release` - Build and run release version
- `make bundle` - Create macOS app bundle (.app)
- `make install` - Install app bundle to Applications
- `make clean` - Clean build artifacts
- `make dev-server` - Start frontend development server
- `make help` - Show help message

## Architecture

### Core Components

- **AppDelegate**: Main application lifecycle management
- **MainWindowController**: Window and WebView management
- **DownloadManager**: File download handling with URLSession
- **Message Handlers**: JavaScript ↔ Swift communication bridge

### WebKit Integration

The app uses WKWebView with custom message handlers for:

- **Download API**: `window.downloadAPI.startDownload(url, filename)`
- **Finder Integration**: `window.downloadAPI.showInFolder(filename)`
- **Clipboard Access**: Enhanced clipboard support for macOS

### File Structure

```
MacDesktop/
├── src/
│   └── main.swift          # Main application code
├── Package.swift           # Swift Package Manager configuration
├── Makefile               # Build automation
└── README.md              # This file
```

## JavaScript API

The macOS version provides the same JavaScript API as the Windows version:

```javascript
// Download a file
window.downloadAPI.startDownload('https://example.com/file.zip', 'file.zip')
  .then(result => console.log('Download started:', result))
  .catch(error => console.error('Download failed:', error));

// Show file in Finder
window.downloadAPI.showInFolder('file.zip')
  .then(result => console.log('Shown in Finder:', result))
  .catch(error => console.error('Failed to show:', error));

// Clipboard access (enhanced for macOS)
navigator.clipboard.writeText('Hello macOS!')
  .then(() => console.log('Text copied to clipboard'));
```

## Menu Bar

The app includes a full native macOS menu bar with:

### App Menu
- About Workspace
- Preferences
- Hide/Show options
- Quit

### File Menu
- New Window
- Open Workspace (Web)
- Open Downloads
- Close Window

### Edit Menu
- Standard edit operations (Undo, Redo, Cut, Copy, Paste, Select All)

### View Menu
- Reload/Force Reload
- Developer Tools (debug builds only)
- Zoom controls

### Window Menu
- Standard window operations

## Keyboard Shortcuts

- `Cmd+N` - New Window
- `Cmd+W` - Open Workspace (Web)
- `Cmd+D` - Open Downloads
- `Cmd+R` - Reload
- `Cmd+Shift+R` - Force Reload
- `Cmd+0` - Actual Size
- `Cmd++` - Zoom In
- `Cmd+-` - Zoom Out
- `Cmd+Option+I` - Developer Tools (debug only)

## Notifications

The app requests notification permissions on startup and shows notifications for:

- Download started
- Download completed
- Download failed

## Security

The app includes proper security configurations:

- **App Transport Security**: Configured to allow local networking
- **Sandboxing**: Minimal permissions for file system access
- **Code Signing**: Ready for distribution (requires developer certificate)

## Debugging

### Debug Mode Features

- Developer tools available via right-click or `Cmd+Option+I`
- Console logging for all operations
- Automatic connection to development server
- Enhanced error reporting

### Console Output

The app provides detailed console output for:

- WebView navigation events
- Download progress and status
- IPC message handling
- Menu actions and shortcuts
- Error conditions

## Distribution

### For Development
```bash
make bundle
```

### For App Store Distribution
1. Configure proper code signing in Xcode
2. Create an archive build
3. Submit through App Store Connect

### For Direct Distribution
1. Create a signed build with Developer ID
2. Notarize the application
3. Distribute as DMG or ZIP

## Troubleshooting

### Common Issues

1. **App won't start**: Check macOS version compatibility (11.0+)
2. **WebView blank**: Ensure development server is running in debug mode
3. **Downloads fail**: Check network connectivity and permissions
4. **Notifications not showing**: Grant notification permissions in System Preferences

### Debug Information

Enable verbose logging by running from Terminal:
```bash
./WorkspaceMac.app/Contents/MacOS/WorkspaceMac
```

## Comparison with Windows Version

| Feature | Windows (Rust/Wry) | macOS (Swift/WebKit) |
|---------|-------------------|---------------------|
| WebView | WebView2 | WKWebView |
| Downloads | Custom downloader service | URLSession |
| File Manager | Windows Explorer | Finder |
| Notifications | Windows Toast | NSUserNotification |
| Tray Icon | System tray | Dock + Menu bar |
| Menu | Win32 native | Cocoa native |
| IPC | Custom protocol | WKScriptMessageHandler |

## Contributing

When contributing to the macOS version:

1. Follow Swift coding conventions
2. Test on multiple macOS versions
3. Ensure feature parity with Windows version
4. Update documentation for any API changes
5. Test both debug and release builds

## License

Same license as the main project.