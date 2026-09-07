@echo off
set SHOWDOWN_PATH=C:/Users/willj/Projects/Pokemon/pokemon-showdown
call tools\lownode.cmd tests\test-mechanics.js
exit /b %ERRORLEVEL%
