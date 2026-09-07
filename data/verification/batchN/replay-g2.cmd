@echo off
set SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
call tools\lownode.cmd engine\replay_one.js --release c28ad0815782 --steering empirical --arm middle --end-state --state --census data/verification/census-pin-9446a684709d.json --games 1200 --turns 20 --team-store data/team-pool-frozen --against data/verification/batchN/dump-baseline.json --config pair-protect-bust --seed "gen9championsvgc2026regmbbo3-2661266222 vs gen9championsvgc2026regmbbo3-2661402381" --out data/verification/batchN/replay-g2.txt
exit /b %ERRORLEVEL%
