@echo off
echo ==========================================
echo   Dance Challenge - Startup Script
echo ==========================================
echo.
echo Installing dependencies (if needed)...
call npm install
echo.
echo Starting development server...
echo Access the game at http://localhost:5173
echo.
call npm run dev
pause
