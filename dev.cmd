@echo off
setlocal
if "%~1"=="" (
  call npm.cmd run dev
) else (
  call npm.cmd run dev -- %*
)
