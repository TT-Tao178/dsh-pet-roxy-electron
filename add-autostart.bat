@echo off
rem Roxy Desktop Pet - add autostart (file: UTF-8 no BOM, CRLF)
chcp 65001 >nul
cd /d "%~dp0"

if not exist "node_modules\electron\dist\electron.exe" (
  echo  还没有安装依赖，请先双击 start.bat 完成首次安装，再运行本脚本。
  pause
  exit /b 1
)

powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Roxy Desktop Pet.lnk');$s.TargetPath='%~dp0node_modules\electron\dist\electron.exe';$s.Arguments='.';$s.WorkingDirectory='%~dp0';$s.WindowStyle=1;$s.Save()"
if errorlevel 1 (
  echo  加入开机自启失败，请重试。
  pause
  exit /b 1
)
echo  已加入开机自启：下次开机 Roxy 会自动出现。
echo  取消自启：双击 remove-autostart.bat
pause