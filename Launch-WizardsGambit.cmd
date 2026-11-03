@echo off
rem Wizard's Gambit launcher for Windows. Double-click to play.
rem It never changes PowerShell execution policy, never stops other programs,
rem and never switches ports silently (saved games belong to the address).
setlocal EnableExtensions
title Wizard's Gambit
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [Wizard's Gambit] Node.js was not found.
  echo Install the free "LTS" version from https://nodejs.org/ ^(default options are fine^),
  echo then close this window and double-click Launch-WizardsGambit.cmd again.
  echo.
  pause
  exit /b 1
)

set "NODEMAJOR="
for /f "tokens=1 delims=v." %%v in ('node -v') do set "NODEMAJOR=%%v"
if not defined NODEMAJOR set "NODEMAJOR=0"
if %NODEMAJOR% LSS 20 (
  echo.
  echo [Wizard's Gambit] Node.js 20 or newer is required. You have:
  node -v
  echo Please install the current LTS version from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

rem Source checkout (src folder present): install dependencies once, then build.
rem Release package (no src folder): the game is already built in dist\.
if exist "src\app\main.ts" (
  where npm.cmd >nul 2>nul
  if errorlevel 1 (
    echo [Wizard's Gambit] npm was not found. It normally comes with Node.js; reinstall Node.js LTS.
    pause
    exit /b 1
  )
  if not exist "node_modules\vite\package.json" (
    echo First-time setup: installing dependencies. This needs an internet connection once.
    call npm.cmd ci --no-audit --no-fund
    if errorlevel 1 (
      echo.
      echo [Wizard's Gambit] Installing dependencies failed. Check your internet connection and try again.
      pause
      exit /b 1
    )
  )
  echo Building the game...
  call npm.cmd run build --silent
  if errorlevel 1 (
    echo.
    echo [Wizard's Gambit] The build failed. The messages above explain why.
    pause
    exit /b 1
  )
)

if not exist "dist\index.html" (
  echo [Wizard's Gambit] The built game ^(dist\index.html^) is missing.
  pause
  exit /b 1
)

echo.
echo Starting Wizard's Gambit. Your browser will open automatically.
echo Keep this window open while you play; close it ^(or press Ctrl+C^) to stop.
echo.
node tools\serve.mjs --open
set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" (
  echo.
  echo [Wizard's Gambit] The server stopped with code %CODE%. See the message above.
  pause
)
exit /b %CODE%
