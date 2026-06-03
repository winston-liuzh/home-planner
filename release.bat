@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ================================
echo   Home Planner 一键发版
echo ================================
echo.

:: 检查 git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 git，请先安装。
    pause
    exit /b 1
)

:: 检查是否有未提交的更改
git diff --quiet 2>nul
if %errorlevel% neq 0 (
    echo [警告] 有未提交的更改，建议先提交。
    echo.
    set /p CONTINUE="是否继续？(y/n): "
    if /i "!CONTINUE!" neq "y" exit /b 0
)

:: 读取当前版本
for /f "tokens=2 delims=:," %%a in ('findstr /C:"\"version\"" package.json') do (
    set CURRENT=%%~a
)
set CURRENT=%CURRENT: =%
echo 当前版本: %CURRENT%
echo.

set /p VERSION="请输入新版本号 (如 0.5.0): "
if "%VERSION%"=="" (
    echo [错误] 版本号不能为空。
    pause
    exit /b 1
)

echo.
echo 即将发布版本: %VERSION%
echo 操作将:
echo   1. 更新 package.json 版本号
echo   2. 提交更改
echo   3. 创建 tag v%VERSION%
echo   4. 推送到 GitHub
echo   5. GitHub Actions 自动打包 Win/Mac/Linux
echo.
set /p CONFIRM="确认发布？(y/n): "
if /i "%CONFIRM%" neq "y" exit /b 0

:: 更新版本号
powershell -Command "(Get-Content package.json) -replace '\"version\": \"[^\"]+\"', '\"version\": \"%VERSION%\"' | Set-Content package.json"

:: 提交
git add package.json
git commit -m "release v%VERSION%"

:: 打 tag
git tag "v%VERSION%"

:: 推送
git push origin main
git push origin "v%VERSION%"

echo.
echo ================================
echo   发布成功！
echo ================================
echo.
echo GitHub Actions 正在自动打包:
echo   - Windows (.exe)
echo   - macOS (.dmg)
echo   - Linux (.AppImage)
echo.
echo 请到 GitHub 仓库的 Actions 页面查看进度。
echo 打包完成后在 Artifacts 中下载。
