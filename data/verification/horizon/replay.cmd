@echo off
set SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
call tools\lownode.cmd engine\replay_one.js --release f30bf025ae28 --steering empirical --arm middle --end-state --state --census data/verification/census-pin-9446a684709d.json --games 1200 --turns 50 --team-store data/team-pool-frozen --config pair-protect-bust --seed "gen9championsvgc2026regmbbo3-2655745450 vs gen9championsvgc2026regmbbo3-2655794301" --out data/verification/horizon/replay-syrupbomb.txt
exit /b %ERRORLEVEL%
