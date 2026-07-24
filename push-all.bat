@echo off
REM Commit + reconcile + push all three repos (ABRA, CHOMP, portfolio).
REM
REM GUARD (2026-07-24): a timer on this machine was running this file every ~2 minutes, which
REM produced hundreds of "auto: <date>" commits and left the repo stuck mid-rebase, fighting every
REM other git operation. This script now REFUSES to run unless you pass GO, so a scheduled task
REM calling it bare does nothing at all.
REM
REM   To push:                     push-all.bat GO
REM   To find the timer calling it: find-autocommit-task.bat
REM
if /I not "%~1"=="GO" (
  echo.
  echo   push-all is DISARMED. It does nothing without the GO argument.
  echo   This is deliberate: an automated timer was calling it every 2 minutes.
  echo.
  echo   To actually commit and push:   push-all.bat GO
  echo   To find the timer:             find-autocommit-task.bat
  echo.
  exit /b 0
)
setlocal
for %%R in ("%~dp0." "%~dp0..\CHOMP" "%~dp0..\..\portfolio") do (
  if exist "%%~fR\.git" (
    echo ===== %%~fR =====
    pushd "%%~fR"
    REM never pile work on top of a half-finished rebase — that is how the repo got stuck before
    if exist "%%~fR\.git\rebase-merge" (
      echo   SKIPPED: a rebase is in progress here. Run "git status" and finish it first.
    ) else (
      git add -A
      git diff --cached --quiet || git commit -m "manual push %DATE% %TIME%"
      git fetch origin
      git merge -X ours --no-edit origin/main
      git push origin main
    )
    popd
  )
)
echo.
echo Done. If it asked you to sign in, approve it and re-run.
pause
