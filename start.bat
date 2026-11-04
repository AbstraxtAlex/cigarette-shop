@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get it from https://nodejs.org then run this again.
  pause
  exit /b 1
)
rem Admin login for /admin comes from admin.local.bat (kept out of git). In production set ADMIN_USER and ADMIN_PASSWORD on the host.
if exist admin.local.bat call admin.local.bat
start "" http://localhost:8080
node server.js
pause
