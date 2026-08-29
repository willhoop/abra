@echo off
REM lownode.cmd -- run node at BELOWNORMAL priority so the desktop stays responsive.
REM
REM WHY THIS EXISTS. Will, 2026-08-11: "U KEEP FREEZING UP AND I HAVE TO FORCE CLOSE YOU".
REM This machine is 16 cores and 13 GB of RAM with ~12 Claude processes already resident.
REM The heavy runs here -- quarantine.js (a 20,000-comparison differential plus three roster
REM stages), the interaction matrix (2,250 staged pairs), the roster, the census -- each pin
REM every core for minutes and each loads the 30 MB store plus the dex plus the tags. Two
REM agents doing that concurrently, plus test batches on top, starved the UI thread and pushed
REM RAM toward swap. A swapping desktop does not look slow, it looks FROZEN.
REM
REM THE FIX IS NOT FEWER AGENTS. Will, 2026-08-11: "NO WE CAN HAVE SEVERAL AGENTS, DO NUMBER 3".
REM Serialising the divisions throws away the parallelism they were cut apart to make safe --
REM the same argument docs/DIVISIONS.md makes about scheduling. Priority is the right lever:
REM the work still gets every idle core, and the moment a foreground window wants one it gets
REM it back. Throughput on an idle machine is unchanged.
REM
REM BELOWNORMAL, NOT LOW. /LOW is the IDLE class -- it can starve outright under sustained load,
REM which would turn a four-minute gate run into an unbounded one and look like a hang, which is
REM the very thing being fixed.
REM
REM USAGE:  tools\lownode.cmd engine\quarantine.js
REM         node tools/lownode.cmd is WRONG -- call the .cmd directly.
REM
REM EXIT CODE: /WAIT propagates node's exit code to ERRORLEVEL, which the tests depend on --
REM a wrapper that swallowed a red test would be far worse than no wrapper. Proven, not assumed:
REM tests/test-lownode.js asserts a failing script still reports failure through this path.
REM
REM ABRA-HEAP, HONOURED HERE FOR THE SAME REASON tests/run-all.js HONOURS IT -- 2026-08-29.
REM A check that costs more than node's default old space declares `ABRA-HEAP: <MB>` in its own
REM header. run-all.js derives that from the child's source and passes --max-old-space-size.
REM THIS WRAPPER DID NOT, and CLAUDE.md mandates THIS wrapper for every heavy run -- so
REM `tools\lownode.cmd tests\test-resolution-order.js` died at exit 134, `Reached heap limit`,
REM and was carried as a red resolution order through eleven test batches. It is not red: at the
REM 6144 MB it asks for it stages 26 arms and passes. A memory ceiling read as a verdict is the
REM same class as a skip read as a pass, which is what this repository keeps paying for.
REM
REM DERIVED FROM THE SCRIPT'S OWN SOURCE, never a table here. A table would go stale exactly as
REM the CI job list did, and the staleness would surface as exit 134 on somebody else's machine.
REM Only the FIRST argument is inspected, and only when it is a file that exists -- that is the
REM documented call shape, and it keeps a user argument out of every place cmd's parser can choke
REM on a quote or a paren. An argument list with no script (`lownode.cmd -e ...`) derives nothing
REM and runs exactly as before. Node requires the flag BEFORE the script path; after it, it is
REM argv and silently does nothing.
set "ABRAHEAP="
if not "%~1"=="" if exist "%~1" call :derive "%~1"
start "" /B /BELOWNORMAL /WAIT node %ABRAHEAP% %*
exit /b %ERRORLEVEL%

:derive
REM THE SLASHES ARE NORMALISED FIRST, AND THAT LINE IS THE WHOLE DIFFERENCE BETWEEN THIS WORKING
REM AND THIS SILENTLY DOING NOTHING. findstr reads a leading `/` in its file argument as a SWITCH,
REM so `findstr ... tests/test-resolution-order.js` opens no file, matches nothing, and the wrapper
REM runs at the default heap having reported no error at all -- measured 2026-08-29 against the
REM same file with backslashes, which derived 5120 correctly. Every invocation in this repository
REM and in CLAUDE.md is written with forward slashes, so the un-normalised version would have been
REM a capability that exists, runs clean and does nothing: the defect this repo is named after.
set "ABRAFILE=%~1"
set "ABRAFILE=%ABRAFILE:/=\%"
for /f "tokens=2 delims=:" %%h in ('findstr /r /c:"ABRA-HEAP: *[0-9][0-9]*" "%ABRAFILE%" 2^>nul') do call :setheap %%h
goto :eof

:setheap
if defined ABRAHEAP goto :eof
set /a _h=%1 2>nul
if "%_h%"=="0" goto :eof
set "ABRAHEAP=--max-old-space-size=%_h%"
goto :eof
