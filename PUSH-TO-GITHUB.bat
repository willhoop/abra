@echo off
REM One-click: create the GitHub repo (if needed) and upload everything.
cd /d "%~dp0"
echo Pushing ABRA to github.com/willhoop/abra ...
where gh >nul 2>nul
if %errorlevel%==0 (
  gh repo create willhoop/abra --public --source=. --remote=origin --push
) else (
  git push -u origin main
)
echo.
echo Done. If it asked you to sign in, approve it and re-run this file.
pause
