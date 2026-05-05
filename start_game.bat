@echo off
echo Starting AI Dance Challenge...
cd /d "%~dp0"
call npm install
start http://localhost:5173
call npm run dev
pause
