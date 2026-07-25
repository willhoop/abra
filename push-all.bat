@echo off
REM Commit + reconcile + push all three repos (ABRA, CHOMP, portfolio).
REM
REM GUARD (2026-07-24): a timer on this machine was running this file every ~2 minutes, which
REM produced hundreds of "auto: <date>" commits and left the repo stuck mid-rebase, fighting every
REM other git operation. This script REFUSES to run unless you pass GO, so a scheduled task calling
REM it bare does nothing at all.
REM
REM FIX (2026-07-24): this script used "git merge -X ours" to reconcile. That is the confirmed cause
REM of the store duplication - data/games.ladder.jsonl is an APPEND-ONLY log, and a non-fast-forward
REM merge replays the appended block, so the same games land twice. It happened once at 7,040
REM duplicate lines and again at 401. It now uses --rebase, which replays OUR commits on top of
REM origin instead of merging two divergent histories, and then runs the deduplicator as a belt-and-
REM braces check. If a conflict appears, it STOPS rather than resolving blindly in either direction:
REM "-X ours" silently discarding someone else's work is how a reconciliation strategy becomes a
REM data-loss strategy.
REM
REM   To push:                     push-all.bat GO
REM   To find the timer:           find-autocommit-task.bat
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
set FAILED=0

for %%R in ("%~dp0." "%~dp0..\CHOMP" "%~dp0..\..\portfolio") do (
  if exist "%%~fR\.git" (
    echo.
    echo ===== %%~fR =====
    pushd "%%~fR"

    REM never pile work on top of a half-finished rebase or merge - that is how the repo got stuck
    if exist "%%~fR\.git\rebase-merge" (
      echo   SKIPPED: a rebase is in progress. Run "git status" and finish it first.
      set FAILED=1
    ) else if exist "%%~fR\.git\rebase-apply" (
      echo   SKIPPED: a rebase is in progress. Run "git status" and finish it first.
      set FAILED=1
    ) else if exist "%%~fR\.git\MERGE_HEAD" (
      echo   SKIPPED: a merge is in progress. Run "git status" and finish it first.
      set FAILED=1
    ) else (

      REM deduplicate the append-only store BEFORE committing, so a duplicated file never gets pushed
      if exist "%%~fR\engine\dedupe_store.py" (
        python "%%~fR\engine\dedupe_store.py" --write
      )

      git add -A
      git diff --cached --quiet || git commit -m "manual push %DATE% %TIME%"

      git fetch origin
      REM rebase, NOT "merge -X ours". Replays our commits on top of origin; no divergent-history
      REM merge, so an append-only file cannot have its appended block replayed.
      git rebase origin/main
      if errorlevel 1 (
        echo.
        echo   REBASE HIT A CONFLICT in %%~fR - nothing has been pushed from here.
        echo   Resolve it yourself, then re-run. This script will NOT auto-resolve:
        echo   the old "-X ours" behaviour silently threw away the other side's work.
        echo     git status
        echo     git rebase --continue    ^(after fixing^)
        echo     git rebase --abort       ^(to back out^)
        set FAILED=1
      ) else (
        git push origin main
        if errorlevel 1 (
          echo   PUSH FAILED in %%~fR - see the message above.
          set FAILED=1
        ) else (
          echo   pushed OK
        )
      )
    )
    popd
  )
)

echo.
if "%FAILED%"=="1" (
  echo ================================================================
  echo   ONE OR MORE REPOS DID NOT PUSH. Read the messages above.
  echo ================================================================
) else (
  echo All repos pushed successfully.
)
pause
