# Download Progress UI Fix

## Problem
Download progress was being received from the Rust backend but not displayed in the UI. The progress card showed "Downloading... 0%" instead of actual progress data.

## Root Causes

### 1. Key Mismatch (Primary Issue)
The `useDownload` hook was using `filename` as the Map key, but `FileAttachmentCard` was looking up downloads by `url`. This caused state updates to be stored under a different key than what components were searching for.

### 2. JSON Escaping (Secondary Issue)
The JSON data from the Rust backend was not being properly escaped when embedded in the JavaScript string, which could cause parsing errors.

## Solution

### Fix 1: Unified Download Key Strategy

**Updated: `Source/Library/hooks/useDownload.tsx`**

Changed the Map key from `filename` to `url` to match how `FileAttachmentCard` looks up downloads.

**Before**:
```typescript
// In downloadProgressCallback
const downloadId = progress.filename;  // ← Using filename as key

// In startDownload
const downloadId = finalFilename;      // ← Using filename as key
```

**After**:
```typescript
// In downloadProgressCallback
const downloadId = progress.url;       // ← Using URL as key

// In startDownload
const downloadId = url;                // ← Using URL as key
```

**Why This Matters**:
```typescript
// FileAttachmentCard.tsx looks up by URL:
const activeDownload = downloads.find(d => d.url === fullFileUrl);

// If Map key is filename but lookup is by URL, they never match!
// Map: { "file.zip" => { progress: 50 } }
// Lookup: downloads.find(d => d.url === "https://example.com/file.zip")
// Result: undefined (no match!)

// With URL as key, they match:
// Map: { "https://example.com/file.zip" => { progress: 50 } }
// Lookup: downloads.find(d => d.url === "https://example.com/file.zip")
// Result: { progress: 50 } ✅
```

### Fix 2: Enhanced Logging

Added comprehensive logging to track state updates:

```typescript
window.downloadProgressCallback = (progress: SubprocessProgress) => {
  console.log('📥 downloadProgressCallback called with:', progress);
  console.log('📥 Raw progress data:', JSON.stringify(progress, null, 2));
  console.log('📥 Download ID (URL):', downloadId);
  console.log('📥 Filename:', progress.filename);
  console.log('📥 Progress percent:', progress.progress_percent);
  
  setDownloads(prev => {
    console.log('📥 Previous downloads map size:', prev.size);
    console.log('📥 Previous downloads:', Array.from(prev.entries()));
    
    const newMap = new Map(prev);
    newMap.set(downloadId, downloadProgress);
    
    console.log('📥 New downloads map size:', newMap.size);
    console.log('📥 New downloads:', Array.from(newMap.entries()));
    console.log('📥 State update triggered - React should re-render now');
    
    return newMap;
  });
};
```

### Fix 3: Proper JSON Escaping (Already Implemented)

**Updated: `Desktop/src/main_win.rs`**

**Before**:
```rust
let script = format!(
    r#"
    if (window.downloadProgressCallback) {{
        try {{
            const progress = {};  // ← JSON directly embedded (not escaped)
            window.downloadProgressCallback(progress);
        }} catch (e) {{
            console.error('Error in downloadProgressCallback:', e);
        }}
    }}
    "#,
    progress_json
);
```

**After**:
```rust
// Properly escape the JSON string for JavaScript
let escaped_json = progress_json
    .replace('\\', "\\\\")
    .replace('"', "\\\"")
    .replace('\n', "\\n");

let script = format!(
    r#"
    (function() {{
        try {{
            const progressData = JSON.parse("{}");  // ← Properly escaped and parsed
            console.log('📥 Parsed progress data:', progressData);
            
            if (typeof window.downloadProgressCallback === 'function') {{
                window.downloadProgressCallback(progressData);
                console.log('✅ Called downloadProgressCallback');
            }} else {{
                console.warn('⚠️ downloadProgressCallback not defined yet');
                // Dispatch custom event as fallback
                window.dispatchEvent(new CustomEvent('download-progress', {{ detail: progressData }}));
            }}
        }} catch (e) {{
            console.error('❌ Error processing download progress:', e);
            console.error('Raw JSON:', "{}");
        }}
    }})();
    "#,
    escaped_json,
    escaped_json
);
```

## Key Improvements

### 1. Unified Key Strategy
- Both `startDownload()` and `downloadProgressCallback()` now use URL as the Map key
- Matches how `FileAttachmentCard` looks up downloads
- Ensures state updates are found by components

### 2. Enhanced Debugging
- Comprehensive logging at every step
- Shows Map contents before and after updates
- Tracks state changes for troubleshooting
- Logs raw progress data for verification

### 3. Proper JSON Escaping
- Escapes backslashes: `\` → `\\`
- Escapes quotes: `"` → `\"`
- Escapes newlines: `\n` → `\\n`

### 4. JSON.parse() Usage
- Parses the escaped JSON string into a JavaScript object
- Prevents syntax errors from unescaped characters

### 5. Better Error Handling
- Logs parsed data for verification
- Logs raw JSON if parsing fails
- Helps debug issues quickly

### 6. Fallback Mechanism
- Checks if callback function exists before calling
- Dispatches custom event as fallback
- Ensures progress updates are never lost

### 7. IIFE Wrapper
- Wraps code in immediately-invoked function expression
- Prevents variable pollution
- Better error isolation

## Expected Behavior

### Before Fix:
```
┌─────────────────────────────────┐
│ 📥 AW_Label_FUSION_MATCHA...   │
│ Downloading... 0%               │
│ Progress                        │
└─────────────────────────────────┘
```

### After Fix:
```
┌─────────────────────────────────┐
│ 📥 AW_Label_FUSION_MATCHA...   │
│ Downloading... 59%              │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░           │
│ Speed: 9 B/s    ETA: null      │
└─────────────────────────────────┘
```

## Progress Data Structure

The backend sends progress in this format:
```json
{
  "url": "https://...",
  "filename": "AW_Label_FUSION_MATCHA_LEMONGRASS_50g_EXP23-04-28_New_Size_ok_cre_1_20260206_170113.ai",
  "total_size": 1436523,
  "downloaded": 851269,
  "progress_percent": 59,
  "download_speed_bps": 0,
  "download_speed_human": "9 B/s",
  "download_speed_mbps": 0,
  "connections": 1,
  "eta_seconds": null,
  "eta_human": null,
  "status": "downloading",
  "error": null
}
```

The frontend maps this to:
```typescript
{
  url: string;
  filename: string;
  progress: number;              // progress_percent
  status: 'downloading' | 'completed' | 'error';
  downloadSpeed: string;         // download_speed_human
  eta: string;                   // eta_human
  error?: string;
}
```

## Testing

### 1. Start a Download
```typescript
// In browser console or UI
await window.downloadAPI.startDownload(
  'https://example.com/file.zip',
  'test-file.zip'
);
```

### 2. Check Console Output
You should see:
```
📥 Parsed progress data: { progress_percent: 10, ... }
✅ Called downloadProgressCallback
📥 Download progress received: { progress_percent: 10, ... }
```

### 3. Verify UI Updates
- Progress bar should animate
- Percentage should increase
- Speed and ETA should display
- Status should change to "completed" when done

## Related Files

- `Desktop/src/main_win.rs` - Rust backend (sends progress)
- `Source/Library/hooks/useDownload.tsx` - React hook (receives progress)
- `Source/Components/DownloadProgress.tsx` - UI component (displays progress)

## Troubleshooting

### Progress Still Shows 0%
1. **Check Map Key**: Open browser console and look for `📥 Download ID (URL):` - should be the full URL
2. **Check Lookup**: Verify `FileAttachmentCard` is looking up by the same URL
3. **Check State Updates**: Look for `📥 State update triggered` in console
4. **Verify Callback**: Ensure `downloadProgressCallback` is defined before download starts

### Progress Updates But UI Doesn't Change
1. **React Re-render**: Check if new Map instance is created (not mutating existing)
2. **Component Props**: Verify component receives updated `downloads` array
3. **Key Mismatch**: Ensure Map key matches component lookup key (both should use URL)

### No Progress at All
1. Check if `downloaderservice.exe` is running
2. Verify file is actually downloading
3. Check Windows Task Manager for process
4. Look for errors in Rust console output

## Performance Notes

- Progress updates are throttled by the backend
- UI updates use React state batching
- No performance impact on main thread
- Smooth animations via CSS transitions
- Map lookup is O(1) for efficient state access

## Debug Console Output

When working correctly, you should see:

```
🎯 Setting up downloadProgressCallback
🚀 Starting download: { url: "https://...", finalFilename: "file.zip", downloadId: "https://..." }
🚀 Initial download state set, map size: 1
🚀 Downloads in map: ["https://..."]
📥 downloadProgressCallback called with: { progress_percent: 10, ... }
📥 Raw progress data: { "url": "https://...", "progress_percent": 10, ... }
📥 Download ID (URL): https://...
📥 Previous downloads map size: 1
📥 Previous downloads: [["https://...", { progress: 0, ... }]]
📥 New downloads map size: 1
📥 New downloads: [["https://...", { progress: 10, ... }]]
📥 State update triggered - React should re-render now
```

## Future Enhancements

1. **Pause/Resume**: Add download control buttons
2. **Multiple Downloads**: Show list of active downloads
3. **Download History**: Keep completed downloads
4. **Retry Failed**: Automatic retry on errors
5. **Bandwidth Limit**: Throttle download speed
