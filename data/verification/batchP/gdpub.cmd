@echo off
call tools\lownode.cmd engine\game_differential.js --steering empirical --release %1 --arm middle --end-state --state --census data/verification/census-pin-9446a684709d.json --games 1200 --turns 50 --team-store data/team-pool-frozen --dump-games 200 --dump-out %2 --write
exit /b %ERRORLEVEL%
