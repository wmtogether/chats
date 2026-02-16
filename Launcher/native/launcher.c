/*
 * Workspace Launcher - Native C Implementation
 * Handles application launching and auto-updates from GitHub releases
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <wininet.h>
#include <shlobj.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#pragma comment(lib, "wininet.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "user32.lib")

#define APP_NAME "Workspace"
#define MAIN_EXE "workspace.exe"
#define VERSION_FILE "version.txt"
#define GITHUB_REPO "wmtogether/chats"
#define BUFFER_SIZE 8192
#define MAX_PATH_LEN 512

typedef struct {
    char version[32];
    char download_url[512];
    char filename[128];
} ReleaseInfo;

// Function prototypes
BOOL GetAppDirectory(char* buffer, size_t size);
BOOL ReadVersionFile(const char* path, char* version, size_t size);
BOOL CheckForUpdates(const char* current_version, ReleaseInfo* release);
BOOL DownloadFile(const char* url, const char* dest_path, HWND hwnd);
BOOL LaunchInstaller(const char* installer_path);
BOOL LaunchMainApp(const char* exe_path);
void ShowError(const char* message);
int ShowUpdateDialog(const char* current_ver, const char* new_ver);

// Get application directory
BOOL GetAppDirectory(char* buffer, size_t size) {
    if (GetModuleFileNameA(NULL, buffer, (DWORD)size) == 0) {
        return FALSE;
    }
    
    // Remove filename, keep directory
    char* last_slash = strrchr(buffer, '\\');
    if (last_slash) {
        *last_slash = '\0';
    }
    
    return TRUE;
}

// Read version from version.txt
BOOL ReadVersionFile(const char* path, char* version, size_t size) {
    FILE* file = fopen(path, "r");
    if (!file) {
        strcpy_s(version, size, "0.0.0");
        return FALSE;
    }
    
    if (fgets(version, (int)size, file)) {
        // Remove newline and 'v' prefix
        size_t len = strlen(version);
        while (len > 0 && (version[len-1] == '\n' || version[len-1] == '\r')) {
            version[--len] = '\0';
        }
        if (version[0] == 'v') {
            memmove(version, version + 1, len);
        }
    }
    
    fclose(file);
    return TRUE;
}

// Check for updates from GitHub
BOOL CheckForUpdates(const char* current_version, ReleaseInfo* release) {
    HINTERNET hInternet = NULL;
    HINTERNET hConnect = NULL;
    BOOL result = FALSE;
    char url[256];
    char buffer[BUFFER_SIZE];
    DWORD bytesRead;
    
    sprintf_s(url, sizeof(url), "https://api.github.com/repos/%s/releases/latest", GITHUB_REPO);
    
    hInternet = InternetOpenA("Workspace-Launcher/1.0", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
    if (!hInternet) goto cleanup;
    
    hConnect = InternetOpenUrlA(hInternet, url, NULL, 0, 
        INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE, 0);
    if (!hConnect) goto cleanup;
    
    // Read response
    if (InternetReadFile(hConnect, buffer, sizeof(buffer) - 1, &bytesRead) && bytesRead > 0) {
        buffer[bytesRead] = '\0';
        
        // Parse JSON (simple string search)
        char* tag_name = strstr(buffer, "\"tag_name\"");
        if (tag_name) {
            char* start = strchr(tag_name, ':');
            if (start) {
                start = strchr(start, '\"');
                if (start) {
                    start++;
                    char* end = strchr(start, '\"');
                    if (end) {
                        size_t len = end - start;
                        if (len < sizeof(release->version)) {
                            strncpy_s(release->version, sizeof(release->version), start, len);
                            release->version[len] = '\0';
                            
                            // Remove 'v' prefix
                            if (release->version[0] == 'v') {
                                memmove(release->version, release->version + 1, strlen(release->version));
                            }
                        }
                    }
                }
            }
        }
        
        // Find .exe asset
        char* browser_download = strstr(buffer, "\"browser_download_url\"");
        while (browser_download) {
            char* url_start = strchr(browser_download, ':');
            if (url_start) {
                url_start = strchr(url_start, '\"');
                if (url_start) {
                    url_start++;
                    char* url_end = strchr(url_start, '\"');
                    if (url_end) {
                        // Check if it's an .exe file
                        if (strstr(url_start, ".exe")) {
                            size_t url_len = url_end - url_start;
                            if (url_len < sizeof(release->download_url)) {
                                strncpy_s(release->download_url, sizeof(release->download_url), 
                                         url_start, url_len);
                                release->download_url[url_len] = '\0';
                                
                                // Extract filename
                                char* filename = strrchr(release->download_url, '/');
                                if (filename) {
                                    strcpy_s(release->filename, sizeof(release->filename), filename + 1);
                                }
                                
                                result = TRUE;
                                break;
                            }
                        }
                    }
                }
            }
            browser_download = strstr(browser_download + 1, "\"browser_download_url\"");
        }
    }
    
cleanup:
    if (hConnect) InternetCloseHandle(hConnect);
    if (hInternet) InternetCloseHandle(hInternet);
    
    return result && strcmp(release->version, current_version) != 0;
}

// Download file with progress
BOOL DownloadFile(const char* url, const char* dest_path, HWND hwnd) {
    HINTERNET hInternet = NULL;
    HINTERNET hConnect = NULL;
    FILE* file = NULL;
    BOOL result = FALSE;
    char buffer[BUFFER_SIZE];
    DWORD bytesRead;
    DWORD totalBytes = 0;
    
    hInternet = InternetOpenA("Workspace-Launcher/1.0", INTERNET_OPEN_TYPE_PRECONFIG, NULL, NULL, 0);
    if (!hInternet) goto cleanup;
    
    hConnect = InternetOpenUrlA(hInternet, url, NULL, 0, 
        INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE, 0);
    if (!hConnect) goto cleanup;
    
    if (fopen_s(&file, dest_path, "wb") != 0) goto cleanup;
    
    while (InternetReadFile(hConnect, buffer, sizeof(buffer), &bytesRead) && bytesRead > 0) {
        fwrite(buffer, 1, bytesRead, file);
        totalBytes += bytesRead;
        
        // Update progress (optional)
        if (hwnd) {
            char progress[64];
            sprintf_s(progress, sizeof(progress), "Downloaded: %.2f MB", totalBytes / (1024.0 * 1024.0));
            SetWindowTextA(hwnd, progress);
        }
    }
    
    result = TRUE;
    
cleanup:
    if (file) fclose(file);
    if (hConnect) InternetCloseHandle(hConnect);
    if (hInternet) InternetCloseHandle(hInternet);
    
    return result;
}

// Launch installer and exit
BOOL LaunchInstaller(const char* installer_path) {
    char cmdline[MAX_PATH_LEN * 2];
    STARTUPINFOA si = {0};
    PROCESS_INFORMATION pi = {0};
    
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    
    // Build command line with update flags
    sprintf_s(cmdline, sizeof(cmdline), "\"%s\" /UPDATE /SILENT", installer_path);
    
    if (!CreateProcessA(NULL, cmdline, NULL, NULL, FALSE, 
                       DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP, 
                       NULL, NULL, &si, &pi)) {
        return FALSE;
    }
    
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    
    return TRUE;
}

// Launch main application
BOOL LaunchMainApp(const char* exe_path) {
    STARTUPINFOA si = {0};
    PROCESS_INFORMATION pi = {0};
    char dir[MAX_PATH_LEN];
    
    si.cb = sizeof(si);
    
    // Get directory from exe path
    strcpy_s(dir, sizeof(dir), exe_path);
    char* last_slash = strrchr(dir, '\\');
    if (last_slash) *last_slash = '\0';
    
    if (!CreateProcessA(exe_path, NULL, NULL, NULL, FALSE, 0, NULL, dir, &si, &pi)) {
        return FALSE;
    }
    
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    
    return TRUE;
}

// Show error message
void ShowError(const char* message) {
    MessageBoxA(NULL, message, "Error", MB_OK | MB_ICONERROR);
}

// Show update dialog
int ShowUpdateDialog(const char* current_ver, const char* new_ver) {
    char message[512];
    sprintf_s(message, sizeof(message), 
             "A new version %s is available.\nCurrent version: %s\n\nUpdate now?",
             new_ver, current_ver);
    
    return MessageBoxA(NULL, message, "Update Available", MB_YESNO | MB_ICONQUESTION);
}

// Main entry point
int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    char app_dir[MAX_PATH_LEN];
    char version_path[MAX_PATH_LEN];
    char current_version[32];
    char exe_path[MAX_PATH_LEN];
    ReleaseInfo release = {0};
    
    // Get application directory
    if (!GetAppDirectory(app_dir, sizeof(app_dir))) {
        ShowError("Failed to get application directory");
        return 1;
    }
    
    // Read current version
    sprintf_s(version_path, sizeof(version_path), "%s\\%s", app_dir, VERSION_FILE);
    ReadVersionFile(version_path, current_version, sizeof(current_version));
    
    // Check for updates
    if (CheckForUpdates(current_version, &release)) {
        if (ShowUpdateDialog(current_version, release.version) == IDYES) {
            // Download installer
            char temp_path[MAX_PATH_LEN];
            GetTempPathA(sizeof(temp_path), temp_path);
            
            char installer_path[MAX_PATH_LEN];
            sprintf_s(installer_path, sizeof(installer_path), "%s%s", temp_path, release.filename);
            
            // Simple progress window
            HWND hwnd = CreateWindowA("STATIC", "Downloading update...", 
                                     WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
                                     CW_USEDEFAULT, CW_USEDEFAULT, 400, 100,
                                     NULL, NULL, hInstance, NULL);
            if (hwnd) {
                ShowWindow(hwnd, SW_SHOW);
                UpdateWindow(hwnd);
            }
            
            if (DownloadFile(release.download_url, installer_path, hwnd)) {
                if (hwnd) DestroyWindow(hwnd);
                
                // Launch installer and exit
                if (LaunchInstaller(installer_path)) {
                    return 0;
                } else {
                    ShowError("Failed to launch installer");
                }
            } else {
                if (hwnd) DestroyWindow(hwnd);
                ShowError("Failed to download update");
            }
        }
    }
    
    // Launch main application
    sprintf_s(exe_path, sizeof(exe_path), "%s\\%s", app_dir, MAIN_EXE);
    if (!LaunchMainApp(exe_path)) {
        char error[512];
        sprintf_s(error, sizeof(error), "Failed to launch %s", MAIN_EXE);
        ShowError(error);
        return 1;
    }
    
    return 0;
}
