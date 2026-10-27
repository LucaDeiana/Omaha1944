@echo off
chcp 65001 >nul
title Fronte Occidentale 1944 - server
cd /d "%~dp0"
rem ---- aggiornamento automatico all'ultima versione pubblicata su GitHub (richiesto dal proprietario del gioco) ----
echo Controllo aggiornamenti...
if exist ".git" (
  where git >nul 2>nul && git pull --ff-only
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $v = '%~dp0versione.txt'; $sha = (Invoke-RestMethod -UseBasicParsing 'https://api.github.com/repos/LucaDeiana/Omaha1944/commits/main' -Headers @{ Accept = 'application/vnd.github.sha' }).Trim(); $old = if (Test-Path $v) { (Get-Content $v -Raw).Trim() } else { '' }; if ($sha -eq $old) { Write-Host 'Il gioco e gia aggiornato.' } else { Write-Host 'Nuova versione disponibile: scarico...'; $z = Join-Path $env:TEMP 'fo1944.zip'; $d = Join-Path $env:TEMP 'fo1944'; Invoke-WebRequest -UseBasicParsing 'https://github.com/LucaDeiana/Omaha1944/archive/refs/heads/main.zip' -OutFile $z; if (Test-Path $d) { Remove-Item $d -Recurse -Force }; Expand-Archive $z $d -Force; $src = (Get-ChildItem $d | Select-Object -First 1).FullName; Get-ChildItem $src | Where-Object { $_.Extension -ne '.bat' } | Copy-Item -Destination '%~dp0' -Recurse -Force; Set-Content $v $sha; Write-Host 'Gioco aggiornato.' } } catch { Write-Host 'Controllo aggiornamenti non riuscito (nessuna connessione?): avvio la versione gia presente.' }"
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
