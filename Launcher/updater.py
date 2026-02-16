"""
Simple updater script that runs the installer after killing the launcher.
This script should be compiled separately as a standalone executable.
"""
import sys
import os
import time
import subprocess

def main():
    if len(sys.argv) < 2:
        print("Usage: updater.exe <installer_path> [args...]")
        sys.exit(1)
    
    installer_path = sys.argv[1]
    installer_args = sys.argv[2:] if len(sys.argv) > 2 else []
    
    # Wait for launcher to exit
    time.sleep(1)
    
    # Force kill any remaining launcher processes
    try:
        subprocess.run(['taskkill', '/F', '/IM', 'launcher.exe'], 
                      capture_output=True, timeout=5)
    except:
        pass
    
    # Wait to ensure process is fully terminated
    time.sleep(1)
    
    # Run installer
    try:
        subprocess.Popen([installer_path] + installer_args)
    except Exception as e:
        print(f"Failed to run installer: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
