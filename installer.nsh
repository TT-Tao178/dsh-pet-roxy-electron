; ============================================================================
; roxy-desktop-pet 自定义 NSIS 脚本（package.json build.nsis.include）
;
; 修复：卸载后残留“空安装目录”的问题。
; 原因：卸载器在 un.onInit 里 SetOutPath $INSTDIR，进程当前目录 = 安装目录，
;       Windows 不允许删除进程自身的当前目录，RMDir /r 删光内容后空目录删不掉。
; 解决：卸载主体执行完后（customUnInstall 时机），把工作目录切到 $TEMP，再删一次。
; ============================================================================
!macro customUnInstall
  SetOutPath "$TEMP"
  RMDir "$INSTDIR"
!macroend
