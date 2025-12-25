; Inno Setup Script for Miko Workspace
; This script creates an installer for the Miko Workspace desktop application
; Target installation directory: %LOCALAPPDATA%\Miko\Workspace

#define MyAppName "Miko Workspace"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Miko Technologies"
#define MyAppURL "https://miko.app"
#define MyAppExeName "mikochat.exe"
#define MyAppProxyName "mikoproxy.exe"

[Setup]
; NOTE: The value of AppId uniquely identifies this application. Do not use the same AppId value in installers for other applications.
AppId={{B8E5F8A2-1234-5678-9ABC-DEF012345678}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Miko\Workspace
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=
PrivilegesRequired=lowest
OutputDir=..\..\Distribution
OutputBaseFilename=MikoWorkspaceSetup
SetupIconFile=..\Shared\Icons\icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
DisableReadyPage=no
DisableFinishedPage=no
ShowLanguageDialog=no
LanguageDetectionMethod=locale

; Windows version requirements
MinVersion=6.1sp1
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

; Uninstall settings
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1; Check: not IsAdminInstallMode

[Files]
; Copy all files and subdirectories from Distribution/Package
Source: "..\..\Distribution\Package\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; NOTE: Don't use "Flags: ignoreversion" on any shared system files

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"; IconIndex: 0
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"; IconIndex: 0; Tasks: desktopicon
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: quicklaunchicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
Type: dirifempty; Name: "{localappdata}\Miko"

[Code]
// Custom functions for installation

function GetUninstallString(): String;
var
  sUnInstPath: String;
  sUnInstallString: String;
begin
  sUnInstPath := ExpandConstant('Software\Microsoft\Windows\CurrentVersion\Uninstall\{#emit SetupSetting("AppId")}_is1');
  sUnInstallString := '';
  if not RegQueryStringValue(HKLM, sUnInstPath, 'UninstallString', sUnInstallString) then
    RegQueryStringValue(HKCU, sUnInstPath, 'UninstallString', sUnInstallString);
  Result := sUnInstallString;
end;

function IsUpgrade(): Boolean;
begin
  Result := (GetUninstallString() <> '');
end;

function UnInstallOldVersion(): Integer;
var
  sUnInstallString: String;
  iResultCode: Integer;
begin
  // Return Values:
  // 1 - uninstall string is empty
  // 2 - error executing the UnInstallString
  // 3 - successfully executed the UnInstallString

  // default return value
  Result := 0;

  // get the uninstall string of the old app
  sUnInstallString := GetUninstallString();
  if sUnInstallString <> '' then begin
    sUnInstallString := RemoveQuotes(sUnInstallString);
    if Exec(sUnInstallString, '/SILENT /NORESTART /SUPPRESSMSGBOXES','', SW_HIDE, ewWaitUntilTerminated, iResultCode) then
      Result := 3
    else
      Result := 2;
  end else
    Result := 1;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep=ssInstall) then
  begin
    if (IsUpgrade()) then
    begin
      UnInstallOldVersion();
    end;
  end;
end;

// Check if WebView2 Runtime is available (system-wide or bundled)
function IsWebView2Available(): Boolean;
var
  RegKey: String;
  Version: String;
begin
  Result := False;
  
  // Check if WebView2 Runtime is installed system-wide
  RegKey := 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  if RegQueryStringValue(HKLM, RegKey, 'pv', Version) then
  begin
    Result := True;
    Log('System WebView2 Runtime found: ' + Version);
  end
  else
  begin
    // Check 32-bit registry
    RegKey := 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
    if RegQueryStringValue(HKLM, RegKey, 'pv', Version) then
    begin
      Result := True;
      Log('System WebView2 Runtime found (32-bit): ' + Version);
    end
    else
    begin
      Log('System WebView2 Runtime not found - will use bundled runtime');
      Result := True; // We're bundling the runtime, so it's always available
    end;
  end;
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  
  // Check WebView2 availability
  if not IsWebView2Available() then
  begin
    MsgBox('WebView2 Runtime is required but not found. The installer will include a bundled runtime.', mbInformation, MB_OK);
  end;
  
  Log('Installation target: ' + ExpandConstant('{localappdata}') + '\Miko\Workspace');
end;

procedure InitializeWizard();
begin
  // Custom wizard initialization if needed
end;

// Custom messages for the installer
[Messages]
WelcomeLabel2=This will install [name/ver] on your computer.%n%nMiko Workspace is a modern desktop chat application with native Windows integration and bundled WebView2 runtime.%n%nIt is recommended that you close all other applications before continuing.
ClickNext=Click Next to continue, or Cancel to exit Setup.
BeveledLabel=Miko Workspace - Modern Desktop Chat Application

[CustomMessages]
LaunchProgram=Launch %1 after installation