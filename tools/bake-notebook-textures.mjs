// Bakes the 3D notebook's procedural textures into image files.
//
//   node tools/bake-notebook-textures.mjs <site origin serving public/>   e.g. http://localhost:3000
//
// Needs `playwright` and a Chrome install (it runs the real texture worker in the browser).
//
// Why: the notebook viewer paints its materials (the leather hide, the suede, the pockets, the kraft papers and more)
// pixel by pixel in a worker on EVERY visit, and draws nothing until all of them are done. Measured: ~4 s on a fast
// computer, 22-55 s on an iPhone 12. The pictures come out the same every time (seeded noise), so this paints them
// once, here, and saves them. At run time public/notebook/assets/texBaked.js stands in for the worker: it fetches the
// files and hands the viewer exactly what the worker would have, message for message.
//
// Two sets, because the worker paints a lighter set on phones and tablets (see prepare-notebook.mjs, step 3):
// public/notebook/baked/desktop and public/notebook/baked/phone. Each has the image files and a manifest.json that
// holds every message's structure, with {"$img": "<file>"} where the worker sent an ImageBitmap.
//
// Run it again whenever the notebook export changes (after prepare-notebook.mjs).
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const origin = process.argv[2]
if (!origin) {
  console.error('usage: node tools/bake-notebook-textures.mjs <site origin, e.g. http://localhost:3000>')
  process.exit(1)
}
const OUT = 'public/notebook/baked'
const viewer = fs.readFileSync('public/notebook/notebook-viewer.js', 'utf8')
// The worker's real script: the one prepare-notebook.mjs wrote (not this tool's stand-in).
const worker = fs.readdirSync('public/notebook/assets').find((f) => /^texWorker-.*\.js$/.test(f))
if (!worker) throw new Error('no texWorker-*.js in public/notebook/assets')
// The keys the viewer asks the worker for, in its order (the Mb list).
const list = viewer.match(/var Mb = \[([\s\S]*?)\], Nb =/)
if (!list) throw new Error('cannot find the material list (Mb) in notebook-viewer.js')
const keys = [...list[1].matchAll(/\["([^"]+)"/g)].map((m) => m[1])

const SETS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: {
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  },
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
for (const [name, ctxOpts] of Object.entries(SETS)) {
  const dir = path.join(OUT, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const page = await (await browser.newContext(ctxOpts)).newPage()
  await page.goto(`${origin}/notebook/notebook-viewer.css`)
  // Runs the worker, and for each message turns every ImageBitmap into a WebP and the rest into plain JSON. Lossy:
  // lossless came to 90 MB for the desktop set. Colour and roughness at 0.85; normal maps at 0.6, because they are
  // fine noise that compresses badly (the hide's alone was 5.3 MB at 0.85) and a lighting map hides the loss.
  const messages = await page.evaluate(
    async ({ url, keys }) => {
      const out = []
      const toB64 = async (bmp, q) => {
        const c = new OffscreenCanvas(bmp.width, bmp.height)
        c.getContext('2d').drawImage(bmp, 0, 0)
        const blob = await c.convertToBlob({ type: 'image/webp', quality: q })
        const bytes = new Uint8Array(await blob.arrayBuffer())
        let s = ''
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        return { b64: btoa(s), w: bmp.width, h: bmp.height }
      }
      const walk = async (v, imgs, prop = '') => {
        if (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) {
          imgs.push(await toB64(v, /normal/i.test(prop) ? 0.6 : 0.85))
          return { $img: imgs.length - 1 }
        }
        if (Array.isArray(v)) return Promise.all(v.map((x) => walk(x, imgs, prop)))
        if (v && typeof v === 'object') {
          const o = {}
          for (const [k, x] of Object.entries(v)) o[k] = await walk(x, imgs, k === 't' || k === 'c' ? prop : k)
          return o
        }
        return v
      }
      await new Promise((resolve, reject) => {
        const w = new Worker(url, { type: 'module' })
        let pending = Promise.resolve()
        w.onmessage = (e) => {
          if (e.data.done) {
            pending.then(resolve)
            return
          }
          pending = pending.then(async () => {
            const imgs = []
            const value = await walk(e.data.value, imgs)
            out.push({ key: e.data.key, value, imgs })
          })
        }
        w.onerror = (e) => reject(new Error(e.message))
        w.postMessage(keys)
      })
      return out
    },
    { url: `${origin}/notebook/assets/${worker}`, keys },
  )
  const manifest = []
  let bytes = 0
  for (const m of messages) {
    const files = m.imgs.map((img, i) => {
      const file = `${m.key}-${i}.webp`
      const buf = Buffer.from(img.b64, 'base64')
      fs.writeFileSync(path.join(dir, file), buf)
      bytes += buf.length
      return { file, w: img.w, h: img.h }
    })
    const fill = (v) =>
      v && typeof v === 'object'
        ? '$img' in v
          ? { $img: files[v.$img].file }
          : Array.isArray(v)
            ? v.map(fill)
            : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)]))
        : v
    manifest.push({ key: m.key, value: fill(m.value) })
    console.log(`${name.padEnd(8)} ${m.key.padEnd(12)} ${files.map((f) => `${f.w}x${f.h}`).join(' ')}`)
  }
  const missing = keys.filter((k) => !manifest.some((m) => m.key === k))
  if (missing.length) throw new Error(`${name}: the worker sent nothing for ${missing.join(', ')}`)
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest))
  console.log(`${name}: ${manifest.length} materials, ${(bytes / 1e6).toFixed(2)} MB`)
}
await browser.close()
