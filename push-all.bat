@echo off
REM Commit + reconcile + push all three repos (ABRA, CHOMP, portfolio).
REM The hourly GitHub ingest Action advances origin, so a plain push gets REJECTED
REM (non-fast-forward). This fetches, merges origin in keeping YOUR local version on any
REM conflict, then pushes — so it always fast-forwards and is never rejected.
setlocal
for %%R in ("%~dp0." "%~dp0..\CHOMP" "%~dp0..\..\portfolio") do (
  if exist "%%~fR\.git" (
    echo ===== %%~fR =====
    pushd "%%~fR"
    git add -A
    git diff --cached --quiet || git commit -m "auto: %DATE% %TIME%"
    git fetch origin
    git merge -X ours --no-edit origin/main
    git push origin main
    popd
  )
)
echo.
echo Done. If it asked you to sign in, approve it and re-run.
pause
