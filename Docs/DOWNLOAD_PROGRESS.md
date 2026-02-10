# Download Progress Implementation

## Overview
The download service (`downloaderservice.exe`) outputs real-time progress as JSON to stdout. The main application reads this progress and forwards it to the frontend via JavaScript callbacks.

## Current Implementation

### Backend (Rust)
1. **Downloader Service** (`Desktop/service/downloader/main.rs`):
   - Outputs JSON progress to stdout in real-time
   - Progress includes: `status`, `progress_percent`, `download_speed_mbps`, `eta_seconds`, etc.

2. **Main Application** (`Desktop/src/main_win.rs`):
   - Spawns the downloader service as a subprocess
   - Reads stdout line-by-line using `BufReader`
   - Parses JSON progress updates
   - Sends progress to frontend via global channel (thread-safe)
   - Evaluates JavaScript in webview to call `window.downloadProgressCallback()`

### Frontend Integration (TypeScript)

The frontend listens for download progress via the `downloadProgressCallback` function:

```typescript
// In useDownload.tsx hook
useEffect(() => {
  // Set up callback for download progress updates
  window.downloadProgressCallback = (progress: SubprocessProgress) => {
    console.log('📥 Download progress received:', progress);
    
    // Update UI with progress
    // progress.progress_percent - percentage complete (0-100)
    // progress.download_speed_human - download speed (e.g., "10.00 MB/s")
    // progress.eta_human - estimated time remaining (e.g., "5s")
    // progress.status - "downloading", "completed", or "error"
  };

  return () => {
    delete window.downloadProgressCallback;
  };
}, []);
```

## Progress JSON Format

```json
{
    "url": "https://example.com/file.zip",
    "filename": "file.zip",
    "total_size": 104857600,
    "downloaded": 52428800,
    "progress_percent": 50.0,
    "download_speed_bps": 10485760.0,
    "download_speed_mbps": 10.0,
    "download_speed_human": "10.00 MB/s",
    "connections": 16,
    "eta_seconds": 5,
    "eta_human": "5s",
    "status": "downloading",
    "error": null
}
```

## Status Values
- `"downloading"` - Download in progress
- `"completed"` - Download finished successfully
- `"error"` - Download failed (check `error` field for details)

## Implementation Details

### Thread-Safe Communication
- Uses `std::sync::mpsc::channel` for thread-safe communication
- Download subprocess sends progress to global sender
- Main event loop polls receiver and evaluates JavaScript in webview
- No blocking operations in the main thread

### Frontend Hook
- `useDownload.tsx` hook manages download state
- Automatically sets up `downloadProgressCallback` on mount
- Maps subprocess progress format to frontend state
- Displays real-time progress, speed, and ETA

## Notes
- Progress updates are sent in real-time from the subprocess
- The frontend receives actual progress, not simulated
- Thread-safety is maintained using channels and non-blocking polling
- Progress is polled in the window event handler to avoid blocking the UI thread
