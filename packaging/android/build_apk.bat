@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================================
REM  单词花园 APK 一键打包脚本（Windows）
REM  用法：双击本文件，或在 android/ 目录执行 build_apk.bat
REM  前置：已安装 Android SDK，且环境变量 ANDROID_HOME 指向 SDK 根目录
REM ============================================================

echo.
echo ============ 单词花园 APK 打包 ============

REM 1. 检查 ANDROID_HOME
if "%ANDROID_HOME%"=="" (
  echo [错误] 未检测到 ANDROID_HOME 环境变量。
  echo 请先安装 Android SDK，并设置 ANDROID_HOME 指向 SDK 根目录。
  echo 例如：setx ANDROID_HOME "C:\Users\cyc68\Android\sdk"
  pause
  exit /b 1
)

echo [1/4] 检查 Android SDK...
echo   ANDROID_HOME = %ANDROID_HOME%

REM 2. 安装 npm 依赖
echo [2/4] 安装 npm 依赖...
call npm install
if errorlevel 1 (
  echo [错误] npm install 失败。
  pause
  exit /b 1
)

REM 3. 生成/同步安卓工程
echo [3/4] 生成安卓工程...
if not exist "android" (
  call npx cap add android
) else (
  call npx cap sync android
)
if errorlevel 1 (
  echo [错误] cap add/sync 失败，请检查 Android SDK 配置。
  pause
  exit /b 1
)

REM 4. 打 APK
echo [4/4] 打包 APK（调试版）...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
  echo [错误] gradle 打包失败。
  cd ..
  pause
  exit /b 1
)
cd ..

echo.
echo ============ 打包完成 ============
echo APK 位置：android\app\build\outputs\apk\debug\app-debug.apk
echo 可直接传到手机安装（需允许"安装未知来源应用"）。
echo.
pause
