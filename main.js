// ============================================================================
// roxy-desktop-pet —— Electron 主进程
//
// 启动本地 http 服务（lib/server.js），在透明无边框置顶窗口中渲染宠物页面。
// 系统托盘：右键可快速切换 鼠标穿透/透明度/置顶/开机自启/打开设置/退出。
// 设置与统计面板：在独立的居中窗口中打开（不再遮挡宠物本体）。
// 用户数据默认 $HOME/.roxy-desktop-pet/（可用 ROXY_HOME 覆盖）。
// ============================================================================
import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer, readWindowState, writeWindowState } from './lib/server.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ICO_PATH = path.join(__dirname, 'ico', 'favicon.ico')

let mainWindow = null // 宠物窗口
let uiWindow = null // 设置/统计窗口
let server = null
let tray = null
let saveTimer = null
let mouseThrough = false

// 托盘菜单需要的最新状态（由页面同步上来）
let trayState = { topMode: 'always', opacity: 1, mouseThrough: false, autostart: false }

const DEFAULT_W = 300
const DEFAULT_H = 480

function sendToPet(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('pet-run', payload)
}
function sendToUi(payload) {
  if (uiWindow && !uiWindow.isDestroyed()) uiWindow.webContents.send('pet-run', payload)
}
function broadcastRun(sender, payload) {
  if (mainWindow && sender !== mainWindow.webContents) sendToPet(payload)
  if (uiWindow && sender !== uiWindow.webContents) sendToUi(payload)
}

// ---------------------------------------------------------------------------
// 托盘
// ---------------------------------------------------------------------------
function rebuildTray() {
  if (!tray) return
  const s = trayState
  const menu = Menu.buildFromTemplate([
    { label: '⚙️ 打开设置', click: () => openUiWindow('settings') },
    { label: '📊 数据统计', click: () => openUiWindow('tasks') },
    { type: 'separator' },
    {
      label: '鼠标穿透',
      type: 'checkbox',
      checked: !!s.mouseThrough,
      click: (item) => sendToPet({ type: 'mouse-through', value: item.checked }),
    },
    {
      label: '透明度',
      submenu: [20, 40, 60, 80, 100].map((pct) => ({
        label: pct + '%',
        type: 'radio',
        checked: Math.round((Number(s.opacity) || 1) * 100) === pct,
        click: () => sendToPet({ type: 'opacity', value: pct / 100 }),
      })),
    },
    {
      label: '置顶方式',
      submenu: [
        {
          label: '一直置顶',
          type: 'radio',
          checked: s.topMode !== 'desktop',
          click: () => sendToPet({ type: 'top-mode', value: 'always' }),
        },
        {
          label: '仅桌面置顶',
          type: 'radio',
          checked: s.topMode === 'desktop',
          click: () => sendToPet({ type: 'top-mode', value: 'desktop' }),
        },
      ],
    },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: !!s.autostart,
      click: (item) => sendToPet({ type: 'autostart', value: item.checked }),
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ])
  tray.setContextMenu(menu)
  tray.setToolTip('Roxy 桌面宠物')
}

function createTray() {
  if (tray) return
  let icon
  try {
    icon = nativeImage.createFromPath(ICO_PATH)
  } catch (err) { /* fallthrough */ }
  if (!icon || icon.isEmpty()) {
    icon = nativeImage.createEmpty()
  }
  tray = new Tray(icon)
  tray.on('double-click', () => openUiWindow('settings'))
  rebuildTray()
}

// ---------------------------------------------------------------------------
// UI 窗口（设置/统计）：屏幕居中的独立普通窗口
// ---------------------------------------------------------------------------
function openUiWindow(kind) {
  if (!server) return
  if (uiWindow && !uiWindow.isDestroyed()) {
    uiWindow.focus()
    return
  }
  uiWindow = new BrowserWindow({
    width: 640,
    height: 780,
    center: true,
    resizable: false,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#eef2f7',
    icon: ICO_PATH,
    title: 'Roxy',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  uiWindow.setMenu(null)
  uiWindow.on('closed', () => { uiWindow = null })
  uiWindow.once('ready-to-show', () => { if (uiWindow) uiWindow.show() })
  uiWindow.loadURL(`http://127.0.0.1:${server.port}/?ui=${kind === 'tasks' ? 'tasks' : 'settings'}`)
}

// ---------------------------------------------------------------------------
// 宠物窗口
// ---------------------------------------------------------------------------
async function createWindow() {
  server = await startServer({ port: 0 })

  let saved = readWindowState()
  let { x, y } = saved
  const { w, h } = saved
  const s = screen.getPrimaryDisplay().workArea
  const valid = Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h)
  if (!valid) {
    x = s.x + s.width - DEFAULT_W - 24
    y = s.y + s.height - DEFAULT_H - 24
  } else if (x + w < s.x || x > s.x + s.width || y + h < s.y || y > s.y + s.height) {
    x = s.x + s.width - DEFAULT_W - 24
    y = s.y + s.height - DEFAULT_H - 24
  }

  mainWindow = new BrowserWindow({
    x,
    y,
    width: valid ? w : DEFAULT_W,
    height: valid ? h : DEFAULT_H,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    icon: ICO_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.on('move', saveBoundsSoon)
  mainWindow.on('resize', saveBoundsSoon)
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  await mainWindow.loadURL(`http://127.0.0.1:${server.port}/`)
}

function saveBoundsSoon() {
  if (!mainWindow) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      const b = mainWindow.getBounds()
      writeWindowState({ x: b.x, y: b.y, w: b.width, h: b.height })
    } catch (err) { /* ignore */ }
  }, 400)
}

// ---------------------------------------------------------------------------
// 穿透（主进程直接管理，两个窗口都通知）
// ---------------------------------------------------------------------------
function applyMouseThrough(enabled) {
  if (!mainWindow) return
  mouseThrough = !!enabled
  trayState.mouseThrough = mouseThrough
  mainWindow.setIgnoreMouseEvents(mouseThrough, { forward: true })
  const msg = { type: 'through-state', value: mouseThrough }
  sendToPet(msg)
  sendToUi(msg)
  rebuildTray()
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
ipcMain.on('pet-move-by', (event, { dx, dy }) => {
  if (!mainWindow) return
  const [cx, cy] = mainWindow.getPosition()
  mainWindow.setPosition(cx + (Number(dx) || 0), cy + (Number(dy) || 0))
})

ipcMain.on('pet-resize-keep-bottom', (event, { w, h }) => {
  if (!mainWindow) return
  const b = mainWindow.getBounds()
  const nw = Math.max(120, Math.min(Math.round(w), 1600))
  const nh = Math.max(160, Math.min(Math.round(h), 1400))
  const wa = screen.getDisplayMatching(b).workArea
  let ny = b.y + b.height - nh
  ny = Math.max(wa.y, Math.min(ny, wa.y + wa.height - nh))
  mainWindow.setBounds({ x: b.x, y: ny, width: nw, height: nh })
})

ipcMain.on('pet-window-set', (event, { w, h }) => {
  if (!mainWindow) return
  const b = mainWindow.getBounds()
  const nw = Math.max(120, Math.min(Math.round(w), 1600))
  const nh = Math.max(160, Math.min(Math.round(h), 1400))
  const wa = screen.getDisplayMatching(b).workArea
  const nx = Math.max(wa.x, Math.min(b.x, wa.x + wa.width - nw))
  const ny = Math.max(wa.y, Math.min(b.y, wa.y + wa.height - nh))
  mainWindow.setBounds({ x: nx, y: ny, width: nw, height: nh })
})

// 置顶模式
ipcMain.on('pet-set-top-mode', (event, mode) => {
  if (!mainWindow) return
  const always = mode !== 'desktop'
  mainWindow.setAlwaysOnTop(always, always ? 'screen-saver' : 'normal')
  mainWindow.setVisibleOnAllWorkspaces(always, { visibleOnFullScreen: true })
})

// 开机自启
ipcMain.on('pet-set-autostart', (event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: !!enabled,
    path: process.execPath,
    args: [__dirname],
  })
})
ipcMain.handle('pet-get-autostart', () => {
  return app.getLoginItemSettings().openAtLogin
})

// 鼠标穿透
ipcMain.on('pet-set-mouse-through', (event, enabled) => {
  applyMouseThrough(enabled)
})

// 透明度（作用于宠物窗口）
ipcMain.on('pet-set-opacity', (event, value) => {
  if (!mainWindow) return
  const v = Math.max(0.2, Math.min(1, Number(value) || 1))
  trayState.opacity = v
  mainWindow.setOpacity(v)
  rebuildTray()
})

// 打开 UI 窗口（宠物右键菜单/预览等请求）
ipcMain.on('pet-open-ui', (event, kind) => {
  openUiWindow(kind)
})

// 页面之间/托盘 -> 页面 的通用指令（广播给除发送者外的窗口）
ipcMain.on('pet-run', (event, payload) => {
  broadcastRun(event.sender, payload)
})

// 页面把当前状态同步给主进程（刷新托盘勾选）
ipcMain.on('pet-state-sync', (event, s) => {
  if (!s || typeof s !== 'object') return
  trayState = {
    topMode: s.topMode === 'desktop' ? 'desktop' : 'always',
    opacity: Math.max(0.2, Math.min(1, Number(s.opacity) || 1)),
    mouseThrough: !!s.mouseThrough,
    autostart: !!s.autostart,
  }
  rebuildTray()
})

ipcMain.on('pet-quit', () => {
  app.quit()
})

// ---------------------------------------------------------------------------
// 生命周期
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  await createWindow()
  createTray()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('will-quit', () => {
  if (tray) { tray.destroy(); tray = null }
})
