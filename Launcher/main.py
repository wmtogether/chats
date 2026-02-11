import sys
import os
import threading
import subprocess
import time

# --- 1. CRITICAL DLL FIX ---
if sys.platform == 'win32':
    import ctypes
    try:
        ctypes.windll.kernel32.SetDllDirectoryW(None)
    except Exception:
        pass

import tkinter as tk
from tkinter import ttk, messagebox
import requests

# --- Configuration ---
APP_NAME = "Workspace"
MAIN_EXE = "workspace.exe"
GITHUB_REPO = "wmtogether/chats"
VERSION_FILE = "version.txt"
INSTALLER_ARGS = ["/UPDATE" ,"/SILENT"]

class LauncherUI:
    def __init__(self):
        self.root = tk.Tk()
        self.root.withdraw() # Hide the main window
        
        # Configure Theme
        self.style = ttk.Style()
        try:
            self.style.theme_use('vista')
        except:
            self.style.theme_use('winnative')

    def show_message(self, title, message, type='info'):
        if type == 'question':
            return messagebox.askyesno(title, message, icon='question')
        elif type == 'error':
            messagebox.showerror(title, message)
        else:
            messagebox.showinfo(title, message)

    def show_download_progress(self, url, dest_path):
        """Shows a thread-safe progress window"""
        self.dl_window = tk.Toplevel(self.root)
        self.dl_window.title("Updating")
        
        # Center Window
        w, h = 400, 150
        ws = self.dl_window.winfo_screenwidth()
        hs = self.dl_window.winfo_screenheight()
        x = (ws // 2) - (w // 2)
        y = (hs // 2) - (h // 2)
        self.dl_window.geometry(f"{w}x{h}+{x}+{y}")
        self.dl_window.resizable(False, False)
        
        # Prevent closing manually
        self.dl_window.protocol("WM_DELETE_WINDOW", lambda: None)

        # UI Elements
        frame = ttk.Frame(self.dl_window, padding="20")
        frame.pack(fill=tk.BOTH, expand=True)

        lbl_title = ttk.Label(frame, text="Downloading Update...", font=("Segoe UI", 11, "bold"))
        lbl_title.pack(anchor="w", pady=(0, 5))

        self.lbl_status = ttk.Label(frame, text="Connecting...", font=("Segoe UI", 9))
        self.lbl_status.pack(anchor="w", pady=(0, 10))

        self.progress = ttk.Progressbar(frame, mode='indeterminate', length=350)
        self.progress.pack(fill=tk.X, pady=(0, 10))
        self.progress.start(15)

        # --- Shared State (For Thread Safety) ---
        self.download_total = 0
        self.download_current = 0
        self.download_complete = False
        self.download_success = False
        self.download_error = None
        self.status_text = "Initializing..."

        # Start Download Thread
        t = threading.Thread(target=self._download_worker, args=(url, dest_path))
        t.daemon = True
        t.start()

        # Start UI Update Loop on Main Thread
        self._check_progress()
        
        self.root.mainloop()
        return self.download_success

    def _check_progress(self):
        """Runs on Main Thread: Updates UI and checks for completion"""
        
        # 1. Update Status Text
        self.lbl_status.config(text=self.status_text)

        # 2. Update Progress Bar
        if self.download_total > 0:
            if self.progress['mode'] == 'indeterminate':
                self.progress.stop()
                self.progress.config(mode='determinate', maximum=self.download_total)
            self.progress['value'] = self.download_current

        # 3. Check if done
        if self.download_complete:
            self.dl_window.destroy()
            self.root.quit() # Exit mainloop
        else:
            # Re-run this check in 50ms
            self.root.after(50, self._check_progress)

    def _download_worker(self, url, dest_path):
        """Runs on Background Thread: NO UI CALLS ALLOWED HERE"""
        try:
            headers = {'User-Agent': 'Workspace-Launcher/1.0'}
            self.status_text = "Requesting file..."
            
            with requests.get(url, headers=headers, stream=True, timeout=60) as r:
                r.raise_for_status()
                
                self.download_total = int(r.headers.get('content-length', 0))
                self.download_current = 0
                
                with open(dest_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            self.download_current += len(chunk)
                            
                            # Calculate MB for status text
                            if self.download_total > 0:
                                mb = self.download_current / (1024 * 1024)
                                total_mb = self.download_total / (1024 * 1024)
                                self.status_text = f"{mb:.1f} MB / {total_mb:.1f} MB"
                            else:
                                mb = self.download_current / (1024 * 1024)
                                self.status_text = f"Downloaded {mb:.1f} MB"

            self.download_success = True
        except Exception as e:
            self.download_error = str(e)
            self.download_success = False
        finally:
            self.download_complete = True

def get_app_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def get_version(app_dir):
    try:
        path = os.path.join(app_dir, VERSION_FILE)
        if os.path.exists(path):
            with open(path, 'r') as f:
                return f.read().strip().lstrip('v')
    except:
        pass
    return "0.0.0"

def main():
    ui = LauncherUI()
    app_dir = get_app_dir()
    current_ver = get_version(app_dir)

    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
        resp = requests.get(url, headers={'User-Agent': 'Workspace-Launcher/1.0'}, timeout=5)
        
        if resp.status_code == 200:
            data = resp.json()
            remote_ver = data['tag_name'].lstrip('v')
            
            if remote_ver != current_ver:
                if ui.show_message(
                    "Update Available", 
                    f"A new version {remote_ver} is available.\nCurrent version: {current_ver}\n\nUpdate now?", 
                    'question'
                ):
                    asset = next((a for a in data['assets'] if a['name'].endswith('.exe')), None)
                    if asset:
                        temp_dir = os.environ.get('TEMP', app_dir)
                        installer_path = os.path.join(temp_dir, asset['name'])
                        
                        if ui.show_download_progress(asset['browser_download_url'], installer_path):
                            # Success: Run Installer
                            cmd = [installer_path] + INSTALLER_ARGS
                            subprocess.Popen(cmd)
                            sys.exit(0)
                        else:
                            ui.show_message("Update Failed", f"Could not download update.\n\n{ui.download_error}", 'error')
                    else:
                        ui.show_message("Error", "No installer (.exe) found in release.", 'error')

    except Exception as e:
        print(f"Update check failed: {e}")

    # Launch Main App
    exe_path = os.path.join(app_dir, MAIN_EXE)
    if os.path.exists(exe_path):
        subprocess.Popen([exe_path], cwd=app_dir)
    else:
        ui.show_message("Error", f"Application not found:\n{MAIN_EXE}", 'error')

if __name__ == "__main__":
    main()