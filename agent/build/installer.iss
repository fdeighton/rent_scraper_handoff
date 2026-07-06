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
#define MyAppCopyright "Copyright (c) Fitzrovia"
#define MyAppURL "https://fitzrovia.ca"

[Setup]
AppId={{F17R0V1A-A6E7-4A11-9C0D-FITZROVIAAGT}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppCopyright={#MyAppCopyright}
; Per-user install (no admin) at a STABLE path — not temp/random. Keeps the silent
; auto-update working (Program Files would require elevation on every update).
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
; Stable version resource on setup.exe itself (Defender/Sentinel read these).
VersionInfoVersion={#MyAppVersion}
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
VersionInfoCopyright={#MyAppCopyright}

[Files]
; The whole PyInstaller COLLECT output folder.
Source: "..\dist\FitzroviaAgent\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
; Start automatically on login:
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"

[Run]
; Launch right after install. postinstall (no skipifsilent) so a SILENT auto-update
; also relaunches the agent; in interactive installs it's the usual "Start" checkbox.
Filename: "{app}\{#MyAppExeName}"; Description: "Start {#MyAppName}"; Flags: nowait postinstall

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
{ The agent is a long-running tray app. Terminate any running instance BEFORE installing
  (so an update can overwrite the locked exe) and BEFORE uninstalling (so removal
  succeeds and no orphan is left running).

  NOTE: no /T (tree) — during a silent AUTO-UPDATE the running agent launches this setup
  as a CHILD process, so /T would kill the setup itself mid-install (aborting the update
  and causing a re-download loop). We kill only FitzroviaAgent.exe by name; the agent's
  Chromium/Playwright children live in a separate cache (they do not lock the install
  folder) and exit once their parent is gone. }
procedure KillAgent();
var ResultCode: Integer;
begin
  Exec('taskkill.exe', '/IM {#MyAppExeName} /F', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
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
