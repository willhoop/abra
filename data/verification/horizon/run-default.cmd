@echo off
set SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
call tools\lownode.cmd engine\game_differential.js --steering empirical --release f30bf025ae28 --arm middle --end-state --state --census data/verification/census-pin-9446a684709d.json --games 1200 --team-store data/team-pool-frozen --dump-games 60 --dump-out data/verification/horizon/dump-default.json --out data/verification/horizon/gd-default.json --write
exit /b %ERRORLEVEL%
