@echo off
REM r4-three-arm.cmd -- the three R4 arms, SEQUENTIAL, overnight 2026-08-14.
REM
REM Sequential and not parallel on purpose: two MILTANK runs at conc 6 each would put 12 workers
REM on a 16-core/13GB machine that froze earlier tonight, and each worker loads the store, the dex
REM and the tags. lownode.cmd keeps every one of them at BELOWNORMAL so a foreground window still
REM gets a core back the instant it wants one.
REM
REM SAME --seed IN ALL THREE, deliberately. The pairing is within a run, but a shared seed means all
REM three arms play the SAME matchups, so run 2 and run 3 can be read against run 1 on identical
REM teams rather than on two different draws.
REM
REM --no-raw because the raw log is the largest thing these runs write and nothing downstream of
REM R4 reads it.

cd /d C:\Users\willj\Projects\Pokemon\ABRA

echo ========== RUN 1: switching alone (MAG vs MAG+switching) ==========
echo START %DATE% %TIME%
call tools\lownode.cmd engine\mew.js --policy score --policy2 score ^
  --switching2 --paired --n 2400 --conc 6 --seed 1 --no-raw ^
  --out data/games.r4a-switching.jsonl
echo RUN1 EXIT %ERRORLEVEL% AT %DATE% %TIME%

echo ========== RUN 2: search alone (MAG+sw vs MILTANK+sw) ==========
echo START %DATE% %TIME%
call tools\lownode.cmd engine\mew.js --policy score --policy2 score ^
  --switching --switching2 --miltank2 --miltank-n 30 ^
  --paired --n 900 --conc 6 --seed 1 --no-raw ^
  --out data/games.r4b-search.jsonl
echo RUN2 EXIT %ERRORLEVEL% AT %DATE% %TIME%

echo ========== RUN 3: as shipped (MAG no-sw vs MILTANK+sw) ==========
echo START %DATE% %TIME%
call tools\lownode.cmd engine\mew.js --policy score --policy2 score ^
  --switching2 --miltank2 --miltank-n 30 ^
  --paired --n 900 --conc 6 --seed 1 --no-raw ^
  --out data/games.r4c-shipped.jsonl
echo RUN3 EXIT %ERRORLEVEL% AT %DATE% %TIME%

echo ========== ALL THREE DONE %DATE% %TIME% ==========
