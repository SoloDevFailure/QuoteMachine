@echo off
setlocal
cd /d "%~dp0"
echo Starting ForteStack...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo ForteStack could not be built.
  pause
  exit /b 1
)
echo.
echo Opening ForteStack at http://127.0.0.1:4173
start "" "http://127.0.0.1:4173"
call npm.cmd run serve:dist
