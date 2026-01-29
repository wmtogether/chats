#!/usr/bin/env python3
"""
Test script to parse real-time JSON output from the downloader service.
Calls ../target/debug/downloaderservice.exe and processes the streaming JSON.
"""

import subprocess
import json
import sys
import os
import time
from datetime import datetime

def format_bytes(bytes_val):
    """Format bytes in human readable format"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_val < 1024.0:
            return f"{bytes_val:.2f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.2f} PB"

def format_time(seconds):
    """Format seconds in human readable format"""
    if seconds is None:
        return "Unknown"
    
    if seconds >= 3600:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours}h {minutes}m {secs}s"
    elif seconds >= 60:
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s"
    else:
        return f"{int(seconds)}s"

def print_progress_bar(progress_percent, width=50):
    """Print a visual progress bar"""
    filled = int(width * progress_percent / 100)
    bar = '█' * filled + '░' * (width - filled)
    return f"[{bar}] {progress_percent:.1f}%"

class RealTimeTUI:
    def __init__(self):
        self.last_data = {}
        self.initialized = False
        
    def clear_screen(self):
        """Clear screen once"""
        os.system('cls' if os.name == 'nt' else 'clear')
        
    def move_cursor_up(self, lines):
        """Move cursor up by specified lines"""
        print(f"\033[{lines}A", end='')
        
    def clear_line(self):
        """Clear current line"""
        print("\033[K", end='')
        
    def update_display(self, data, start_time, update_count):
        """Update display with real-time data without blinking"""
        status = data.get('status', 'unknown')
        filename = data.get('filename', 'unknown')
        total_size = data.get('total_size', 0)
        downloaded = data.get('downloaded', 0)
        chunk_size = data.get('chunk_size', 0)
        progress_percent = data.get('progress_percent', 0.0)
        speed_bps = data.get('download_speed_bps', 0.0)
        speed_human = data.get('download_speed_human', '0 B/s')
        eta_seconds = data.get('eta_seconds')
        eta_human = data.get('eta_human', 'Unknown')
        connections = data.get('connections', 1)
        current_time = time.time()
        
        # Initialize display on first run
        if not self.initialized:
            self.clear_screen()
            print("🔥 REAL-TIME DOWNLOADER MONITOR 🔥")
            print("=" * 80)
            print(f"📁 File: {filename}")
            print(f"📊 Status: {status.upper()}")
            print(f"🔗 Connections: {connections}")
            print("=" * 80)
            print("📈 Progress: [Initializing...]")
            print("💾 Downloaded: 0 B / 0 B")
            print("📦 Last Chunk: 0 B")
            print("⚡ Speed: 0 B/s")
            print("⏱️  Elapsed: 0s")
            print("⏳ ETA: Unknown")
            print("🔢 Updates: 0")
            print("🔄 Updates/sec: 0.0")
            print("\n" + "─" * 80)
            print("💡 Press Ctrl+C to cancel download")
            self.initialized = True
            return
            
        # Move cursor to update lines (go back to progress line)
        self.move_cursor_up(8)  # Move up to progress line
        
        # Update progress bar
        progress_bar = print_progress_bar(progress_percent)
        self.clear_line()
        print(f"📈 Progress: {progress_bar}")
        
        # Update downloaded info
        self.clear_line()
        print(f"💾 Downloaded: {format_bytes(downloaded)} / {format_bytes(total_size)}")
        
        # Update chunk info
        self.clear_line()
        print(f"� Last Chunk: {format_bytes(chunk_size)}")
        
        # Update speed
        self.clear_line()
        print(f"⚡ Speed: {speed_human} ({speed_bps:.0f} B/s)")
        
        # Update elapsed time
        elapsed = current_time - start_time
        self.clear_line()
        print(f"⏱️  Elapsed: {format_time(elapsed)}")
        
        # Update ETA
        self.clear_line()
        print(f"⏳ ETA: {eta_human}")
        
        # Update counters
        self.clear_line()
        print(f"🔢 Updates: {update_count}")
        
        # Update frequency
        updates_per_sec = update_count / elapsed if elapsed > 0 else 0
        self.clear_line()
        print(f"🔄 Updates/sec: {updates_per_sec:.1f}")
        
        # Flush output to ensure immediate display
        sys.stdout.flush()

def main():
    if len(sys.argv) != 3:
        print("Usage: python testparsedownloader.py <URL> <OUTPUT_PATH>")
        print("Example: python testparsedownloader.py https://example.com/file.zip ./downloads/")
        sys.exit(1)
    
    url = sys.argv[1]
    output_path = sys.argv[2]
    
    # Path to the downloader executable
    exe_path = os.path.join("..", "target", "debug", "downloaderservice.exe")
    
    if not os.path.exists(exe_path):
        print(f"Error: Downloader executable not found at {exe_path}")
        print("Please build the project first with: cargo build --bin downloaderservice")
        sys.exit(1)
    
    print(f"🚀 Starting download...")
    print(f"📁 URL: {url}")
    print(f"💾 Output: {output_path}")
    print(f"⚡ Executable: {exe_path}")
    print("=" * 80)
    print("Initializing real-time monitor...")
    time.sleep(1)  # Brief pause before starting
    
    tui = RealTimeTUI()
    
    try:
        # Start the downloader process
        process = subprocess.Popen(
            [exe_path, url, output_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,  # Line buffered
            universal_newlines=True
        )
        
        start_time = time.time()
        update_count = 0
        
        # Process each line of JSON output in real-time
        for line in process.stdout:
            line = line.strip()
            if not line:
                continue
                
            try:
                # Parse JSON
                data = json.loads(line)
                update_count += 1
                
                status = data.get('status', 'unknown')
                
                if status == 'downloading':
                    # Real-time updates without clearing screen
                    tui.update_display(data, start_time, update_count)
                    
                elif status == 'error':
                    error_msg = data.get('error', 'Unknown error')
                    print(f"\n\n❌ ERROR: {error_msg}")
                    break
                    
                elif status == 'completed':
                    filename = data.get('filename', 'unknown')
                    downloaded = data.get('downloaded', 0)
                    current_time = time.time()
                    elapsed = current_time - start_time
                    avg_speed = downloaded / elapsed if elapsed > 0 else 0
                    
                    print(f"\n\n✅ DOWNLOAD COMPLETED!")
                    print(f"📁 File: {filename}")
                    print(f"💾 Size: {format_bytes(downloaded)}")
                    print(f"⏱️  Time: {format_time(elapsed)}")
                    print(f"⚡ Avg Speed: {format_bytes(avg_speed)}/s")
                    print(f"🔢 Total Updates: {update_count}")
                    break
                    
                elif status in ['starting', 'connecting']:
                    # Show initial status updates
                    if not tui.initialized:
                        tui.update_display(data, start_time, update_count)
                
            except json.JSONDecodeError as e:
                print(f"\n⚠️  JSON Parse Error: {e}")
                print(f"Raw line: {line}")
                continue
        
        # Wait for process to complete
        return_code = process.wait()
        
        if return_code != 0:
            stderr_output = process.stderr.read()
            print(f"\n❌ Process failed with return code {return_code}")
            if stderr_output:
                print(f"Error output: {stderr_output}")
        
    except KeyboardInterrupt:
        print("\n\n🛑 Download cancelled by user")
        process.terminate()
        process.wait()
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        if 'process' in locals():
            process.terminate()
            process.wait()

if __name__ == "__main__":
    main()