@echo off
setlocal EnableExtensions

rem Keep the production process separate from deployment.  The release step
rem must run `npm ci` and `npm run build` before this command is restarted.
cd /d "%~dp0..\.."

if not exist "data\logs" mkdir "data\logs"

:restart
call npm.cmd run start -- --hostname 0.0.0.0 --port 3000 >> "data\logs\production.stdout.log" 2>> "data\logs\production.stderr.log"
timeout /t 5 /nobreak >nul
goto restart
