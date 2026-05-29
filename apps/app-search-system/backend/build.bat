@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo SOP Server - Build Script
echo ========================================
echo.

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

:: 检查 config.json
if not exist "config.json" (
    if exist "config.example.json" (
        echo 复制配置文件...
        copy config.example.json config.json
    )
)

:: 检查 PyInstaller
python -m PyInstaller --version >nul 2>&1
if errorlevel 1 (
    echo 安装 PyInstaller...
    pip install pyinstaller
)

:: 清理之前的构建
echo 清理之前的构建...
if exist "dist\sop_server" (
    rd /s /q "dist\sop_server"
)
if exist "build\sop_server" (
    rd /s /q "build\sop_server"
)

:: 打包
echo 运行 PyInstaller...
pyinstaller sop_server.spec
if errorlevel 1 (
    echo ERROR: 构建失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo 构建完成!
echo 输出: backend\dist\sop_server\sop_server.exe
echo.
echo 注意: 首次运行会自动创建数据库和默认管理员账号
echo       admin / admin123
echo ========================================
pause
