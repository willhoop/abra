@echo off
REM Starts the idle-triggered publisher (build\auto-push.ps1) in a visible window.
REM It watches ABRA, CHOMP and portfolio, and pushes ONCE after 3 minutes of quiet.
REM Close this window to stop it. For a hidden copy that starts at logon, run AUTO-PUSH-INSTALL.bat
cd /d "%~dp0"
title ABRA auto-push (idle publisher)
echo ============================================================
echo   Auto-push is watching ABRA, CHOMP and portfolio.
echo   It pushes once, 3 minutes after you stop changing files.
echo   It does nothing at all when there is nothing to publish.
echo   Log: build\auto-push.log
echo   Close this window to stop it.
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build\auto-push.ps1"
echo.
echo (auto-push stopped)
pause
