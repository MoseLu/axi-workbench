@echo off
chcp 65001 >nul 2>&1
echo ==============================================================
echo SOP Backend - NSIS 安装包构建脚本
echo ==============================================================
echo.

cd /d "%~dp0"

:: 检查 NSIS
set NSIS_PATH=C:\Program Files\NSIS\makensis.exe
if not exist "%NSIS_PATH%" (
    set NSIS_PATH=C:\Program Files (x86)\NSIS\makensis.exe
)
if not exist "%NSIS_PATH%" (
    echo [错误] 未找到 NSIS！
    pause
    exit /b 1
)

:: 检查 exe
if not exist "dist\sop_server\sop_server.exe" (
    echo [错误] 未找到 sop_server.exe！
    echo 请先运行 build.bat 打包后端
    pause
    exit /b 1
)

:: 准备干净的打包暂存目录（排除散落的 root jpg）
echo 正在准备干净的打包暂存目录...
python -c "
import shutil, os
src = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'pdf_images')
staging = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'installer_staging', 'data', 'pdf_images')
if os.path.exists(staging):
    shutil.rmtree(staging)
os.makedirs(staging)
for entry in os.scandir(src):
    if entry.is_dir():
        dst = os.path.join(staging, entry.name)
        os.makedirs(dst)
        for f in os.scandir(entry.path):
            if f.is_file() and f.name.endswith('.jpg'):
                shutil.copy2(f.path, dst)
print(f'已生成干净的暂存目录（仅 hash 子目录下的 jpg）')
"

if errorlevel 1 (
    echo [错误] 暂存目录准备失败！
    pause
    exit /b 1
)

:: 构建
echo 正在构建 NSIS 安装包...
echo 脚本: installer\backend.nsi
echo.

"%NSIS_PATH%" installer\backend.nsi

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
echo ==============================================================
pause
