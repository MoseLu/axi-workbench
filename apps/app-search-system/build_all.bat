@echo off
chcp 65001 >nul 2>&1
echo ==============================================================
echo  SOP 系统构建脚本 - 一键打包所有端
echo ==============================================================
echo.

set SCRIPT_DIR=%~dp0
set FRONTEND_DIR=%SCRIPT_DIR%frontend
set BACKEND_DIR=%SCRIPT_DIR%backend

:: ============ Step 1: Build Python Backend ============
echo [1/5] 打包 Python 后端...
echo        输出: backend\dist\sop_server\sop_server.exe
echo.

cd /d "%BACKEND_DIR%"
if not exist "config.json" (
    if exist "config.example.json" (
        copy config.example.json config.json >nul 2>&1
        echo        [提示] 已复制 config.example.json ^> config.json
    )
)

python -m PyInstaller --version >nul 2>&1
if errorlevel 1 (
    echo        安装 PyInstaller...
    pip install pyinstaller
)

if exist "dist\sop_server" (
    rd /s /q "dist\sop_server" 2>nul
)
if exist "build\sop_server" (
    rd /s /q "build\sop_server" 2>nul
)

pyinstaller sop_server.spec
if errorlevel 1 (
    echo.
    echo [错误] 后端打包失败！
    pause
    exit /b 1
)

echo        后端打包完成
echo.

:: ============ Step 2: Build React Frontend ============
echo [2/5] 构建 React 前端...
echo        输出: frontend\build\
echo.

cd /d "%FRONTEND_DIR%"

if not exist "node_modules" (
    echo        安装依赖...
    call pnpm install
)

echo        运行 react-scripts build...
call pnpm run build
if errorlevel 1 (
    echo.
    echo [错误] React 构建失败！
    pause
    exit /b 1
)

echo        React 构建完成
echo.

:: ============ Step 2.5: Publish Web Bundle (热更新包) ============
echo [2.5/5] 发布 Web Bundle (热更新)...
echo         打包 frontend\build\ → backend\bundle_updates\bundle.zip
echo         如后端服务器运行中，将自动广播给所有在线设备
echo.

cd /d "%SCRIPT_DIR%"
python backend\publish_bundle.py ^
    --build-dir frontend\build ^
    --data-dir backend ^
    --server http://127.0.0.1:8765
:: 不检查 errorlevel，bundle 发布失败不阻断后续打包
echo.

:: ============ Step 3: Build Control Electron App ============
echo [3/5] 打包中控端 (Electron)...
echo        输出: frontend\control\dist\
echo.

cd /d "%FRONTEND_DIR%\control"

if not exist "node_modules" (
    echo        安装依赖...
    call pnpm install
)

echo        运行 electron-builder...
call pnpm run build
if errorlevel 1 (
    echo.
    echo [错误] 中控端打包失败！
    pause
    exit /b 1
)

echo        中控端打包完成
echo.

:: ============ Step 4: Build Display Electron App ============
echo [4/5] 打包展示端 (Electron)...
echo        输出: frontend\display\dist\
echo.

cd /d "%FRONTEND_DIR%\display"

if not exist "node_modules" (
    echo        安装依赖...
    call pnpm install
)

echo        运行 electron-builder...
call pnpm run build
if errorlevel 1 (
    echo.
    echo [错误] 展示端打包失败！
    pause
    exit /b 1
)

echo        展示端打包完成
echo.

:: ============ Step 5: Build Android APK ============
echo [5/5] 打包 Android APK...
echo        输出: frontend\display\android\app\build\outputs\apk\debug\
echo.

cd /d "%FRONTEND_DIR%\display"

:: 添加 Capacitor（如果没有 android 目录）
if not exist "android" (
    echo        初始化 Capacitor Android 项目...
    call pnpm exec cap add android
)

call pnpm exec cap sync android
if errorlevel 1 (
    echo        [警告] Capacitor sync 失败，跳过 APK 构建
) else (
    cd android
    call ./gradlew assembleDebug
    if errorlevel 1 (
        echo        [警告] Gradle 构建失败
    ) else (
        echo        APK 构建完成
    )
    cd /d "%FRONTEND_DIR%\display"
)

echo.
echo ==============================================================
echo  构建完成！
echo ==============================================================
echo.
echo  输出目录:
echo    后端:      backend\dist\sop_server\sop_server.exe
echo    中控端 exe: frontend\control\dist\
echo    展示端 exe: frontend\display\dist\
echo    APK:       frontend\display\android\app\build\outputs\apk\debug\
echo.
echo  首次运行后端会自动创建数据库
echo  默认管理员: admin / admin123
echo ==============================================================
echo.
pause
