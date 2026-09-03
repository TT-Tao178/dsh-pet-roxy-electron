@echo off
setlocal
rem Roxy Desktop Pet - one-click start (UTF-8 no BOM, CRLF)
chcp 65001 >nul
cd /d "%~dp0"
title Roxy Desktop Pet

rem 国内镜像：让 Electron 二进制从 npmmirror 下载（可提前自行设置覆盖）
if "%ELECTRON_MIRROR%"=="" set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [错误] 没有找到 Node.js。请先到 https://nodejs.org 安装，再双击本文件。
  echo.
  pause
  exit /b 1
)

rem 用 electron.exe 是否存在来判断是否装好（目录存在但没装上不算）
if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo  首次运行：正在安装依赖（约 100MB，请耐心等待，不要关窗口）...
  echo.
  call npm install --no-audit --no-fund
  if not exist "node_modules\electron\dist\electron.exe" (
    echo  Electron 二进制没有随安装下载，现在手动补下...
    node "node_modules\electron\install.js"
    if errorlevel 1 (
      echo  下载时证书校验失败，尝试忽略证书后重试（仅本次安装）...
      set "NODE_TLS_REJECT_UNAUTHORIZED=0"
      node "node_modules\electron\install.js"
    )
    if not exist "node_modules\electron\dist\electron.exe" (
      echo.
      echo  [错误] Electron 下载失败。请检查网络或代理后，重新双击本文件。
      echo.
      pause
      exit /b 1
    )
  )
)

echo.
echo  正在启动 Roxy ...
call npm start
if errorlevel 1 (
  echo.
  echo  [提示] 程序已退出，或启动失败。
  echo         正常关闭宠物：右键 Roxy → 菜单里点「退出」。
  echo.
  pause
)
endlocal