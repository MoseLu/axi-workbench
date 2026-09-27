@echo off
setlocal

:: MCP Server Launcher for NSSM
:: Note: MCP requires BLINKO_URL to point to Blinko service

set "LOG_DIR=D:\logs"
set "MCP_LOG=%LOG_DIR%\axi-docs-mcp.log"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "TSX_BIN=C:\Users\12081\AppData\Roaming\npm\node_modules\tsx\dist\tsx.js"
set "SERVER_TS=F:\docs\project\axi-docs\app\src\mcp\server.ts"

echo [%date% %time%] === MCP Server Starting === > "%MCP_LOG%"

:: Kill existing on port 3011
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3011 " ^| findstr "LISTENING"') do (
    echo [%date% %time%] Killing %%a >> "%MCP_LOG%"
    taskkill /F /PID %%a >> "%MCP_LOG%" 2>&1
)

timeout /t 2 /nobreak > nul

:: Start MCP server
echo [%date% %time%] Starting MCP server... >> "%MCP_LOG%"
cmd /c "set MCP_HTTP_PORT=3011 && set BLINKO_URL=http://localhost:1111 && \"%NODE_EXE%\" \"%TSX_BIN%\" \"%SERVER_TS%\" http >> \"%MCP_LOG%\" 2>&1"

echo [%date% %time%] Server exited >> "%MCP_LOG%"

:: Restart on crash
timeout /t 5 /nobreak > nul
goto :eof
