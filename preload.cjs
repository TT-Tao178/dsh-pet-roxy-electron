// ============================================================================
// roxy-desktop-pet —— preload（CommonJS！Electron 沙箱渲染进程不支持 ESM preload）
// 把窗口控制安全地暴露给页面：window.petDesktop
// ============================================================================
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('petDesktop', {
  // ---- 宠物窗口控制 ----
  // 拖拽移动窗口（dx/dy 为屏幕坐标增量）
  moveBy: (dx, dy) => ipcRenderer.send('pet-move-by', { dx: Number(dx) || 0, dy: Number(dy) || 0 }),
  // 改变窗口尺寸并保持底部不动（宠物缩放时用）
  resizeKeepBottom: (w, h) => ipcRenderer.send('pet-resize-keep-bottom', { w: Math.round(w), h: Math.round(h) }),
  // 置顶模式：'always' 一直置顶 / 'desktop' 仅桌面置顶
  setTopMode: (mode) => ipcRenderer.send('pet-set-top-mode', mode),
  // 开机自启开关（返回 Promise<boolean> 当前是否已自启）
  setAutostart: (enabled) => ipcRenderer.send('pet-set-autostart', !!enabled),
  getAutostart: () => ipcRenderer.invoke('pet-get-autostart'),
  // 鼠标穿透
  setMouseThrough: (enabled) => ipcRenderer.send('pet-set-mouse-through', !!enabled),
  // 窗口透明度（0.2 ~ 1）
  setOpacity: (value) => ipcRenderer.send('pet-set-opacity', Number(value)),

  // ---- UI 窗口（设置/统计）与面板 ----
  // 请求打开独立 UI 窗口：'settings' | 'tasks'
  openUi: (kind) => ipcRenderer.send('pet-open-ui', kind),
  // 发送通用指令（会被主进程广播给另一个窗口，如预览表情/刷新配置）
  sendRun: (payload) => ipcRenderer.send('pet-run', payload),
  // 接收通用指令（来自托盘、另一个窗口或穿透快捷键）
  onRun: (cb) => {
    ipcRenderer.on('pet-run', (_e, payload) => { try { cb(payload) } catch (err) { /* ignore */ } })
  },
  // 把当前偏好同步给主进程（刷新托盘菜单勾选）
  stateSync: (s) => ipcRenderer.send('pet-state-sync', s),
  // 穿透状态变化（含快捷键切换）
  onMouseThroughChange: (cb) => {
    ipcRenderer.on('pet-through-state', (_e, v) => { try { cb(!!v) } catch (err) { /* ignore */ } })
  },

  // 退出应用
  quit: () => ipcRenderer.send('pet-quit'),
})
