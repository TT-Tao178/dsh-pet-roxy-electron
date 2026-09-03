// ============================================================================
// roxy-desktop-pet —— 服务端冒烟测试（不依赖 Electron，验证本地 http 服务）
// 用法：node scripts/smoke-server.mjs
// ============================================================================
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-desktop-smoke-'))
process.env.ROXY_HOME = tmpHome

const { startServer } = await import('../lib/server.js')

let pass = 0
let fail = 0
function check(label, cond, extra) {
  if (cond) { pass++; console.log('  ✔ ' + label) }
  else { fail++; console.log('  ✘ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')) }
}

const srv = await startServer({ port: 0 })
const base = `http://127.0.0.1:${srv.port}`

async function get(pathname) {
  const r = await fetch(base + pathname)
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch (e) { /* not json */ }
  return { status: r.status, text, json }
}
async function send(method, pathname, body) {
  const r = await fetch(base + pathname, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch (e) { /* not json */ }
  return { status: r.status, json }
}

console.log('== 页面与脚本 ==')
const idx = await get('/')
check('GET / 返回 index.html（含 widget.js）', idx.status === 200 && idx.text.indexOf('/widget.js') !== -1)
const w = await get('/widget.js')
check('GET /widget.js 200 且含 __roxyDesktopPet', w.status === 200 && w.text.indexOf('__roxyDesktopPet') !== -1)

console.log('== 配置（无余额字段） ==')
const cfg = await get('/config')
check('config ok 且含 expressions', cfg.json.ok === true && !!cfg.json.config.expressions)
check('config 无 reactions（已去除计费）', cfg.json.config.reactions === undefined)
check('config 无 balanceLow', cfg.json.config.reactions === undefined || cfg.json.config.reactions.balanceLow === undefined)
check('config lines 含 4 组', Array.isArray(cfg.json.config.lines) && cfg.json.config.lines.length === 4)
check('config reportLines 存在', !!cfg.json.config.reportLines && !!cfg.json.config.reportLines.taskDone)

console.log('== 包内图片 ==')
const img = await get('/image?name=roxy0.png')
check('GET /image?name=roxy0.png 200 PNG', img.status === 200 && img.text.length > 1000)
const imgBad = await get('/image?name=..%2F..%2Fetc%2Fpasswd')
check('路径穿越被拒（回落 index 或 404 而非文件）', imgBad.status === 404 || imgBad.text.indexOf('<!DOCTYPE') !== -1)

console.log('== 任务看板 ==')
const t1 = await send('POST', '/tasks', { title: '桌面版测试任务' })
check('POST /tasks ok', t1.json && t1.json.ok === true)
const taskId = t1.json.task.id
const t2 = await get('/tasks')
check('GET /tasks 统计 today.total=1', t2.json.ok && t2.json.today.total === 1)
const t3 = await send('PATCH', '/tasks?id=' + taskId, { status: 'doing' })
check('PATCH → doing', t3.json.ok && t3.json.task.status === 'doing')
const t4 = await send('PATCH', '/tasks?id=' + taskId, { status: 'done' })
check('PATCH → done', t4.json.ok && t4.json.task.status === 'done')
const t5 = await send('DELETE', '/tasks?id=' + taskId)
check('DELETE ok', t5.json.ok === true)

console.log('== 用户图片上传（1x1 PNG） ==')
const PNG1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const u1 = await send('POST', '/user-image', { slot: 'happy', mime: 'image/png', data: PNG1 })
check('上传成功', u1.json && u1.json.ok === true)
const u2 = await get('/user-image?name=' + encodeURIComponent(u1.json.fileName))
check('下发 200', u2.status === 200)
const u3 = await send('DELETE', '/user-image?name=' + encodeURIComponent(u1.json.fileName))
check('删除 ok', u3.json && u3.json.ok === true)

console.log('== prefs ==')
const p1 = await send('PUT', '/prefs', { prefs: { scale: 1.3 } })
check('PUT prefs ok', p1.json && p1.json.ok === true)
const p2 = await get('/config')
check('prefs 深合并 scale=1.3', p2.json.config.prefs.scale === 1.3)

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
await srv.close()
fs.rmSync(tmpHome, { recursive: true, force: true })
process.exit(fail ? 1 : 0)
