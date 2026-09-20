@echo off
setlocal enabledelayedexpansion

:: Axi Docs Project Launcher
:: Uses Node.js directly to run Vite (avoids pnpm/npm .ps1 script issues)

set "LOG_DIR=D:\logs"
set "FRONTEND_LOG=%LOG_DIR%\axi-docs-frontend.log"
set "PROJECT_LOG=%LOG_DIR%\axi-docs.log"

echo [%date% %time%] === Axi Docs Starting === > "%PROJECT_LOG%"

:: Kill existing
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3005 " ^| findstr "LISTENING"') do (
    echo [%date% %time%] Killing %%a >> "%PROJECT_LOG%"
    taskkill /F /PID %%a >> "%PROJECT_LOG%" 2>&1
)

timeout /t 2 /nobreak > nul

:: Start using node.exe directly (avoids PowerShell script issues)
echo [%date% %time%] Starting frontend via node... >> "%PROJECT_LOG%"
start "axi-docs" cmd /c "cd /d F:\docs\project\axi-docs\app && node node_modules\vite\bin\vite.js --port 3005 --host 127.0.0.1 --base /docs >> "%FRONTEND_LOG%" 2>&1"

echo [%date% %time%] Started >> "%PROJECT_LOG%"

:: Monitor
:monitor
timeout /t 20 /nobreak > nul
netstat -ano | findstr ":3005 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] Port down, restarting... >> "%PROJECT_LOG%"
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3005 " ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1
    start "axi-docs" cmd /c "cd /d F:\docs\project\axi-docs\app && node node_modules\vite\bin\vite.js --port 3005 --host 127.0.0.1 --base /docs >> "%FRONTEND_LOG%" 2>&1"
)
goto monitor
