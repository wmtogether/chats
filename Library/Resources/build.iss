#define MyAppName "Printing Workspace"
#define MyAppPublisher "Mikofure"
#define MyAppExeName "launcher.exe"

; Read version from version.txt
#define MyAppVersion Trim(FileRead(FileOpen(SourcePath + "version.txt")))

[Setup]
AppId={{B8E5F8A2-1234-5678-9ABC-DEF012345678}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}

DefaultDirName={localappdata}\Miko\Workspace
AllowNoIcons=yes
PrivilegesRequired=lowest
Compression=lzma
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes

CloseApplications=yes
CloseApplicationsFilter=launcher.exe,workspace.exe
RestartIfNeededByRun=no

OutputDir=..\..\Distribution
OutputBaseFilename=WorkspaceSetup

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Code]
var
  IsUpdateMode: Boolean;

function InitializeSetup(): Boolean;
var
  I: Integer;
begin
  IsUpdateMode := False;
  
  // Check for /UPDATE parameter
  for I := 1 to ParamCount do
  begin
    if CompareText(ParamStr(I), '/UPDATE') = 0 then
    begin
      IsUpdateMode := True;
      Break;
    end;
  end;
  
  Result := True;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  // In update mode, skip all pages including Ready page
  if IsUpdateMode then
  begin
    case PageID of
      wpWelcome, wpLicense, wpPassword, wpInfoBefore, wpUserInfo,
      wpSelectDir, wpSelectComponents, wpSelectProgramGroup, wpSelectTasks,
      wpReady, wpPreparing, wpInfoAfter, wpFinished:
        Result := True;
    else
      Result := False;
    end;
  end
  else
    Result := False;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  // In update mode, auto-start installation when reaching wpReady
  if IsUpdateMode and (CurPageID = wpReady) then
  begin
    WizardForm.NextButton.OnClick(nil);
  end;
end;

function IsNotUpdateMode(): Boolean;
begin
  Result := not IsUpdateMode;
end;

function CheckIsUpdateMode(): Boolean;
begin
  Result := IsUpdateMode;
end;

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked; Check: IsNotUpdateMode

[Files]
Source: "..\..\Distribution\Package\*"; \
  DestDir: "{app}"; \
  Flags: ignoreversion recursesubdirs createallsubdirs

Source: "version.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\{#MyAppName}"; \
  Filename: "{app}\{#MyAppExeName}"; \
  Tasks: desktopicon

[Run]
; Normal install → checkbox to launch
Filename: "{app}\{#MyAppExeName}"; \
  Description: "Launch {#MyAppName}"; \
  Flags: nowait postinstall skipifsilent; \
  Check: IsNotUpdateMode

; Update mode → always relaunch silently after installation
Filename: "{app}\{#MyAppExeName}"; \
  Flags: nowait postinstall runhidden; \
  Check: CheckIsUpdateMode
