@echo off
setlocal
cd /d "%~dp0"
echo Starting PILLAR BUILDWORKS...
call npm.cmd run build
if errorlevel 1 (
  echo PILLAR BUILDWORKS could not be built.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:4173"
call npm.cmd run serve:dist
