@echo off
chcp 65001 >nul
cd /d "%~dp0"

:: 尝试定位 node / npm，优先使用 workbuddy 内置版本
set "NODE_PATH="
if exist "C:\Users\lyh\.workbuddy\binaries\node\versions\22.22.2\node.exe" (
    set "NODE_DIR=C:\Users\lyh\.workbuddy\binaries\node\versions\22.22.2"
    set "PATH=%NODE_DIR%;%PATH%"
)

:: 检查 npm 是否可用
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Node.js / npm，请确认已安装 Node.js 。
    echo        下载地址：https://nodejs.org
    pause
    exit /b 1
)

echo.
echo ╔════════════════════════════════╗
echo ║    🐢 海龟汤开发环境启动中...    ║
echo ╚════════════════════════════════╝
echo.

echo [1/2] 启动后端服务器 (Express + Socket.IO :3001)...
start "海龟汤-后端" cmd /c "cd /d "%~dp0" && set "PATH=%NODE_DIR%;%PATH%" && npm run dev:server"

echo [2/2] 启动前端服务器 (Vite :5173)...
start "海龟汤-前端" cmd /c "cd /d "%~dp0" && set "PATH=%NODE_DIR%;%PATH%" && npm run dev:client"

echo.
echo ─────────────────────────────────
echo   后端: http://localhost:3001
echo   前端: http://localhost:5173
echo ─────────────────────────────────
echo.
echo ⏳ 等待服务器就绪 (约5秒)...

timeout /t 5 /nobreak >nul

echo 🚀 正在打开浏览器预览...
start http://localhost:5173

echo.
echo ✅ 启动完毕！关闭此窗口不会影响服务器运行。
echo    如需停止服务器，请关闭 "海龟汤-后端" 和 "海龟汤-前端" 两个命令行窗口。
echo.

pause
