@echo off
set SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
call tools\lownode.cmd engine\game_differential.js --steering empirical --release %1 --arm middle --end-state --state --census data/verification/census-pin-9446a684709d.json --games 1200 --turns %2 --team-store data/team-pool-frozen --dump-games 60 --dump-out %3 --out %4 --write %5 %6
exit /b %ERRORLEVEL%
