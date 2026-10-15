@echo off
title Fronte Occidentale 1944 - server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js non trovato. Installalo da https://nodejs.org e riprova.
  pause
  exit /b
)
start "" http://localhost:8080
node server\server.js 8080
pause
