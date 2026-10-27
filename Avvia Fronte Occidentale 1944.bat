@echo off
chcp 65001 >nul
title Fronte Occidentale 1944 - server
cd /d "%~dp0"
rem ---- aggiornamento automatico all'ultima versione pubblicata su GitHub (richiesto dal proprietario del gioco) ----
echo Controllo aggiornamenti...
if exist ".git" (
  where git >nul 2>nul && git pull --ff-only
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $z = Join-Path $env:TEMP 'fo1944.zip'; $d = Join-Path $env:TEMP 'fo1944'; Invoke-WebRequest -UseBasicParsing 'https://github.com/lucadeiana/omaha1944/archive/refs/heads/main.zip' -OutFile $z; if (Test-Path $d) { Remove-Item $d -Recurse -Force }; Expand-Archive $z $d -Force; $src = (Get-ChildItem $d | Select-Object -First 1).FullName; Get-ChildItem $src | Where-Object { $_.Extension -ne '.bat' } | Copy-Item -Destination '%~dp0' -Recurse -Force; Write-Host 'Gioco aggiornato all ultima versione.' } catch { Write-Host 'Aggiornamento non riuscito (nessuna connessione o repository privato): avvio la versione gia presente.' }"
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js non trovato. Installalo da https://nodejs.org e riprova.
  pause
  exit /b
)
start "" http://localhost:8080
node server\server.js 8080
pause
