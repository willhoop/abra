@echo off
cd /d "%~dp0"
echo Starting ABRA WORLD (local server)...
echo Leave this window open. Close it to stop.
start "" http://localhost:8790
node server.js
pause
