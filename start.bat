@echo off
cd /d "%~dp0"
title ABRA WORLD server
echo ============================================================
echo   Starting ABRA WORLD local server...
echo   Leave THIS window OPEN. A browser tab opens in a moment.
echo   Close this window to stop the server.
echo ============================================================
echo.
REM check Node is installed
where node >nul 2>&1
if errorlevel 1 (
  echo  ERROR: Node.js is not installed or not on your PATH.
  echo  Install it from https://nodejs.org  then run start.bat again.
  echo.
  pause
  exit /b
)
REM open the browser AFTER the server has had a moment to start (fixes the race)
start "" cmd /c "timeout /t 2 >nul & start """" http://localhost:8790"
node server.js
echo.
echo (server stopped)
pause
