@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist .env (
  copy .env.example .env
  notepad .env
)
start "" /min cmd /c "timeout /t 3 >nul & start http://localhost:3002"
node server.js
pause
