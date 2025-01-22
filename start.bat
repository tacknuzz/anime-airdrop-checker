@echo off

echo ===================================
echo   Installing dependencies...
echo ===================================
npm install

echo.
echo ===================================
echo   Starting Checker
echo ===================================
node index.js

echo.
echo Press any key to close...
pause > nul
