@echo off
rem Roxy Desktop Pet - remove autostart (file: UTF-8 no BOM, CRLF)
chcp 65001 >nul
powershell -NoProfile -Command "$p=[Environment]::GetFolderPath('Startup')+'\Roxy Desktop Pet.lnk';if(Test-Path $p){Remove-Item $p;Write-Output '已取消开机自启'}else{Write-Output '没有找到自启项（可能本来就没开）'}"
echo.
pause