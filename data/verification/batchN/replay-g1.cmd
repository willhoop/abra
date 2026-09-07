@echo off
set SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
call tools\lownode.cmd engine\replay_one.js --release c28ad0815782 --steering empirical --arm middle --end-state --state --census data/verification/census-pin-9446a684709d.json --games 1200 --turns 20 --team-store data/team-pool-frozen --against data/verification/batchN/dump-baseline.json --config omit-spread --seed "gen9championsvgc2026regmbbo3-2662243229 vs gen9championsvgc2026regmbbo3-2662159754" --out data/verification/batchN/replay-g1.txt
exit /b %ERRORLEVEL%
