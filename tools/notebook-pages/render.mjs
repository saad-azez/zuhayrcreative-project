// Draws the notebook's first spread (index.html, draw.js) and writes it to public/notebook-pages/.
//
//   PW_CORE=<path to playwright-core> node tools/notebook-pages/render.mjs
//
// The page is served from this folder on a throwaway local port, so fonts, data and logos load as they would on a site.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(HERE, '../../public/notebook-pages')
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_CORE || 'playwright-core')
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' }

const server = http.createServer((req, res) => {
  const p = path.join(HERE, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!p.startsWith(HERE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.writeHead(404).end()
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' })
  fs.createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
page.on('pageerror', (e) => console.error('page error:', e.message))
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`)
await page.waitForFunction(() => document.documentElement.dataset.done === '1', null, { timeout: 120000 })
fs.mkdirSync(OUT, { recursive: true })
for (const [id, name] of [['p1', 'plain-1'], ['p2', 'plain-2'], ['p3', 'plain-3'], ['p4', 'plain-4']]) {
  // Drawn at the notebook page's full 1536 x 2932, shipped at three quarters of that: open and close up, a page is never
  // more than about 1100 px tall on screen even at 2x, and the four come to about a third of the bytes.
  const url = await page.evaluate((id) => {
    const src = document.getElementById(id)
    const out = document.createElement('canvas')
    out.width = Math.round(src.width * 0.75)
    out.height = Math.round(src.height * 0.75)
    const ctx = out.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, out.width, out.height)
    return out.toDataURL('image/webp', 0.86)
  }, id)
  const file = path.join(OUT, `${name}.webp`)
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'))
  console.log(file, (fs.statSync(file).size / 1024).toFixed(0), 'KB')
}
await browser.close()
server.close()
