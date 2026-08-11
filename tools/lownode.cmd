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
start "" /B /BELOWNORMAL /WAIT node %*
exit /b %ERRORLEVEL%
