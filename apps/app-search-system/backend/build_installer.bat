@echo off
chcp 65001 >nul 2>&1
echo ==============================================================
echo SOP Backend - NSIS 安装包构建脚本
echo ==============================================================
echo.

set SCRIPT_DIR=%~dp0
set NSIS_SCRIPT=%SCRIPT_DIR%installer\backend.nsi

:: 检查 NSIS 是否安装
where makensis >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 NSIS！
    echo.
    echo 请先安装 NSIS:
    echo   下载地址: https://nsis.sourceforge.io/Download
    echo   或使用 Chocolatey: choco install nsis
    echo.
    pause
    exit /b 1
)

:: 检查 NSIS 脚本是否存在
if not exist "%NSIS_SCRIPT%" (
    echo [错误] 未找到 NSIS 脚本: %NSIS_SCRIPT%
    pause
    exit /b 1
)

:: 检查 exe 是否存在
if not exist "%SCRIPT_DIR%dist\sop_server\sop_server.exe" (
    echo [错误] 未找到 sop_server.exe！
    echo 请先运行 build.bat 打包后端
    pause
    exit /b 1
)

:: 构建 NSIS 安装包
echo 正在构建 NSIS 安装包...
echo 脚本: %NSIS_SCRIPT%
echo.

makensis "%NSIS_SCRIPT%"

if errorlevel 1 (
    echo.
    echo [错误] NSIS 构建失败！
    pause
    exit /b 1
)

echo.
echo ==============================================================
echo 构建成功！
echo.
echo 输出文件: backend\installer\SOP_Server_Setup_v1.0.exe
echo.
echo 提示: 安装后运行 sop_server.exe 将不会再显示 ANSI 颜色乱码
echo ==============================================================
pause