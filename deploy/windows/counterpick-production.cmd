@echo off
setlocal EnableExtensions

rem This entry point is intended for Task Scheduler. It runs the public
rem server continuously and waits briefly before a restart after a failure.
for %%I in ("%~dp0..\..") do set "COUNTERPICK_ROOT=%%~fI"
cd /d "%COUNTERPICK_ROOT%"

:serve
call npm.cmd run start -- --hostname 0.0.0.0 --port 3000
timeout /t 5 /nobreak >nul
goto serve
