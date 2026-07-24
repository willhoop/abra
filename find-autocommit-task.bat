@echo off
REM ---------------------------------------------------------------------------
REM Finds (and optionally deletes) whatever is running push-all.bat on a timer.
REM
REM Background: push-all.bat was firing every ~2 minutes, producing hundreds of
REM "auto: <date>" commits and leaving the repo stuck mid-rebase. push-all.bat is
REM now disarmed, but the timer itself still exists and should be removed.
REM
REM Run this file. It only READS until you confirm a deletion.
REM ---------------------------------------------------------------------------
setlocal EnableDelayedExpansion
echo.
echo ============================================================
echo   Searching Windows Task Scheduler for tasks that run
echo   push-all.bat / ABRA ...
echo ============================================================
echo.

set "FOUND="
REM /v = verbose (includes the command each task runs), /fo LIST = readable
for /f "tokens=1,* delims=:" %%A in ('schtasks /query /fo LIST /v 2^>nul ^| findstr /i "TaskName Task_To_Run"') do (
  set "line=%%A:%%B"
  echo !line! | findstr /i "push-all ABRA Pokemon" >nul && (
    echo   HIT: !line!
    set "FOUND=1"
  )
)

if not defined FOUND (
  echo   No Scheduled Task references push-all.bat or ABRA.
  echo.
  echo   The timer may instead be:
  echo     - a Startup shortcut:  shell:startup   ^(paste into Run, Win+R^)
  echo     - a background window running a loop  ^(check the taskbar^)
  echo     - an editor/IDE auto-commit extension ^(e.g. a VS Code git auto-commit^)
  echo.
  goto :listall
)

echo.
echo ------------------------------------------------------------
echo   To delete one of the tasks listed above, run:
echo       schtasks /delete /tn "EXACT_TASK_NAME_HERE" /f
echo   ^(copy the name exactly as printed after TaskName:^)
echo ------------------------------------------------------------
echo.

:listall
echo.
echo Full list of non-Microsoft scheduled tasks, for reference:
echo ------------------------------------------------------------
schtasks /query /fo TABLE 2>nul | findstr /v /i "\\Microsoft\\"
echo ------------------------------------------------------------
echo.
echo Also check Startup items:  press Win+R, type  shell:startup  and press Enter.
echo.
pause
