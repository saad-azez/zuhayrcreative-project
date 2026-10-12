// Prepares the 3D notebook's prebuilt bundle for this site.
//
//   node tools/prepare-notebook.mjs <the export's dist folder> [public/notebook]
//
// The export is a Vite LIBRARY build, and a library build has two habits that suit a package and not a web page:
//
//  1. Every image the code imports is written INTO the script, as base64 text. The viewer's script arrives as 12 MB, of
//     which 10.5 MB is seventeen texture scans; its worker is another 2.6 MB, of which 2.5 MB is three of those same scans
//     over again. A browser has to download, parse and hold all of that as a string before one of them is decoded, and it
//     fetches every scan whether or not the book on screen uses it.
//     Here each scan becomes a real .webp file beside the scripts, and the scripts point at it by a relative URL. The
//     bytes of each picture are untouched (they are decoded from the base64 and written out as they are). They now load
//     in parallel with the code, only the ones a material asks for, once each: the worker and the page share a file.
//
//  2. The worker's address is written from the root of the site ("/assets/…"), so the bundle only finds its worker when
//     it is served from a site's root. It is made relative, like the scans.
//
// Nothing else in the scripts is changed, and the run checks that: put the pictures back and the worker's address, and
// each script must be the export's own file again, byte for byte.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const [src, dst = 'public/notebook'] = process.argv.slice(2)
if (!src) {
  console.error('usage: node tools/prepare-notebook.mjs <the export\'s dist folder> [public/notebook]')
  process.exit(1)
}

const DATA = /data:image\/([a-z]+);base64,([A-Za-z0-9+/=]+)/g
const mb = (n) => (n / 1e6).toFixed(2) + ' MB'

fs.rmSync(dst, { recursive: true, force: true })
fs.mkdirSync(path.join(dst, 'assets'), { recursive: true })

/** name of the file a scan is written to: by content, so the same picture is one file wherever it is used */
const written = new Map()
function scanFile(ext, b64) {
  const bytes = Buffer.from(b64, 'base64')
  const name = `scan-${crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 12)}.${ext}`
  if (!written.has(name)) {
    fs.writeFileSync(path.join(dst, 'assets', name), bytes)
    written.set(name, bytes.length)
  }
  return name
}

/**
 * Rewrites one script. `rel` is where the assets folder is from that script ("./assets/" for the viewer, "./" for the
 * worker, which lives in it). Returns the new text and what is needed to undo it, for the check.
 */
function rewrite(text, rel) {
  const undo = []
  let out = text.replace(DATA, (whole, ext, b64, at) => {
    const url = rel + scanFile(ext, b64)
    const q = text[at - 1] // the quote the data URL sits in: " or `
    // Two forms. Inside new URL(…, import.meta.url) only the address changes. A bare string (an image imported "?url")
    // becomes that same new URL(…) expression, which is what Vite writes for it in an app build.
    const inUrl = /new URL\(\s*$/.test(text.slice(Math.max(0, at - 24), at - 1))
    if (inUrl) {
      undo.push([url, whole])
      return url
    }
    const expr = `${q}, import.meta.url).href`
    undo.push([`new URL(${q}${url}${expr}`, `${q}${whole}${q}`])
    return `\u0000${url}\u0000`
  })
  // The bare-string form needs its quotes replaced too: mark, then swap quote + mark for the expression.
  out = out.replace(/(["`])\u0000([^\u0000]+)\u0000\1/g, (_, q, url) => `new URL(${q}${url}${q}, import.meta.url).href`)
  return { out, undo }
}

const report = []
function prepare(file, rel, extra = []) {
  const original = fs.readFileSync(path.join(src, file), 'utf8')
  let { out, undo } = rewrite(original, rel)
  for (const [from, to] of extra) {
    if (out.split(from).length !== 2) throw new Error(`${file}: expected exactly one ${from}`)
    out = out.replace(from, to)
    undo.push([to, from])
  }
  // The check: undo every substitution and the export's own text must come back.
  let back = out
  for (const [now, was] of undo) {
    if (back.split(now).length !== 2) throw new Error(`${file}: cannot verify, "${now.slice(0, 60)}" is not unique`)
    back = back.replace(now, was)
  }
  if (back !== original) throw new Error(`${file}: the rewritten script does not reduce to the export's`)
  fs.mkdirSync(path.dirname(path.join(dst, file)), { recursive: true })
  fs.writeFileSync(path.join(dst, file), out)
  report.push(`${file.padEnd(34)} ${mb(Buffer.byteLength(original)).padStart(9)} -> ${mb(Buffer.byteLength(out)).padStart(8)}   (${undo.length} substitutions, verified)`)
}

const workers = fs.readdirSync(path.join(src, 'assets')).filter((f) => f.endsWith('.js'))
if (workers.length !== 1) throw new Error(`expected one worker script in ${src}/assets, found ${workers.length}`)
prepare('notebook-viewer.js', './assets/', [[`"/assets/${workers[0]}"`, `"./assets/${workers[0]}"`]])
prepare(`assets/${workers[0]}`, './')
fs.copyFileSync(path.join(src, 'notebook-viewer.css'), path.join(dst, 'notebook-viewer.css'))

console.log(report.join('\n'))
console.log(`${written.size} scans written to ${dst}/assets, ${mb([...written.values()].reduce((a, b) => a + b, 0))} in all`)
const total = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? total(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0)
console.log(`folder: ${mb(total(src))} -> ${mb(total(dst))}`)
