; Inno Setup script — Fitzrovia Agent (Windows installer)
; Build:  iscc /DMyAppVersion=0.1.0 build\installer.iss
; Input:  agent\dist\FitzroviaAgent\   (produced by PyInstaller via agent.spec)
; Output: agent\build\Output\FitzroviaAgent-<version>-setup.exe
;
; Installs per-user (no admin prompt), starts the tray app on login, and launches
; it right after install — which triggers the one-click browser pairing on first run.

#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif
#define MyAppName "Fitzrovia Agent"
#define MyAppPublisher "Fitzrovia"
#define MyAppExeName "FitzroviaAgent.exe"

[Setup]
AppId={{F17R0V1A-A6E7-4A11-9C0D-FITZROVIAAGT}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\FitzroviaAgent
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=Output
OutputBaseFilename=FitzroviaAgent-{#MyAppVersion}-setup
SetupIconFile=..\assets\icon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Files]
; The whole PyInstaller COLLECT output folder.
Source: "..\dist\FitzroviaAgent\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
; Start automatically on login:
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"

[Run]
; Launch right after install (first run → browser pairing).
Filename: "{app}\{#MyAppExeName}"; Description: "Start {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
{ The agent is a long-running tray app. Terminate any running instance (+ its child
  Chromium/Playwright processes) BEFORE installing (so an update can overwrite the
  locked exe) and BEFORE uninstalling (so removal succeeds and no orphan is left
  running). }
procedure KillAgent();
var ResultCode: Integer;
begin
  Exec('taskkill.exe', '/IM {#MyAppExeName} /T /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  KillAgent();          { stop a running instance before files are written (update case) }
  Result := '';
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    KillAgent();        { stop the running instance before removing files }
end;
