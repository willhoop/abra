@echo off
REM ---------------------------------------------------------------------------
REM Installs (or removes) the idle publisher so it runs hidden at logon.
REM
REM It is a Startup shortcut, NOT a scheduled task — there is no timer. The script
REM sits idle and only acts once your changes have been quiet for 3 minutes.
REM
REM   AUTO-PUSH-INSTALL.bat            -> install
REM   AUTO-PUSH-INSTALL.bat remove     -> uninstall
REM ---------------------------------------------------------------------------
setlocal
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\ABRA auto-push.lnk"
set "VBS=%~dp0build\auto-push-hidden.vbs"

if /I "%~1"=="remove" (
  if exist "%LNK%" ( del "%LNK%" & echo Removed from Startup. ) else ( echo Nothing installed. )
  echo Note: this only stops it starting at logon. Close any running window to stop it now.
  pause & exit /b 0
)

REM tiny launcher so no console window appears at logon
> "%VBS%" echo Set s = CreateObject("Wscript.Shell")
>> "%VBS%" echo s.Run "powershell -NoProfile -ExecutionPolicy Bypass -File ""%~dp0build\auto-push.ps1""", 0, False

REM create the Startup shortcut
powershell -NoProfile -Command ^
  "$w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut('%LNK%'); $s.TargetPath='%VBS%'; $s.WorkingDirectory='%~dp0'; $s.Description='ABRA idle publisher - pushes after changes go quiet'; $s.Save()"

if exist "%LNK%" (
  echo.
  echo   Installed. Auto-push will start hidden each time you log in.
  echo   Starting it now as well...
  start "" wscript.exe "%VBS%"
  echo.
  echo   Log:      build\auto-push.log
  echo   Remove:   AUTO-PUSH-INSTALL.bat remove
) else (
  echo   Could not create the Startup shortcut. Run AUTO-PUSH-START.bat manually instead.
)
echo.
pause
