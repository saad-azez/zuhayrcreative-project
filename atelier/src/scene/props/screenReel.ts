import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'
import zMark from '../../../data/z-mark.json'
import { LOOP } from '../../layout'
import { a } from '../../lib/assets'

// The laptop's screen as a studio reel (11 Oct, the user: "animated, not a fixed static screen: fast switching motions,
// graphics, designs"): a rapid montage of design work cut like a showreel. Layouts snap into a grid, swatches slide in, the Z's
// vector path draws itself, the Z rasterises into pixels, type specimens, a site wireframe assembling, a dither ramp, kinetic
// type, the mark, a growth chart, an RGB-split glitch and a live Bezier. All in the brand's reds, silvers, pearl and ink.
// One 1024 x 640 canvas, redrawn about 12 times a second (Desk.tsx), a pure function of the loop time: 24 cuts fill exactly one
// 16.4 s loop, so the poster frame and reduced motion show a real frame of it.
// 17 Oct (the user: "keep laptop graphics but also include website scenes/sections"): five cuts show the live site
// (zuhayrcreative.org: home, AI automation, services, work, let's talk; public/laptop) in a browser window, scrolling in, pushing
// in slowly, a cursor clicking. 29 cuts per loop.

export const REEL = { w: 1024, h: 640, fps: 12 } as const
const C = { crimson: '#c4010d', ox: '#5a0614', pearl: '#f4efe3', chrome: '#c9ccd1', ink: '#0e0e10', silver: '#d3d6db', hot: '#ff2a45', grey: '#3a3a3e' }
const MONO = "'ZC Mono', ui-monospace, monospace"
const ANTON = "'ZC Anton', Impact, sans-serif"

type Ctx = CanvasRenderingContext2D
type Scene = (g: Ctx, p: number, seed: number) => void

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3)
const backOut = (x: number) => { const c = clamp01(x), s = 1.9; return 1 + (s + 1) * Math.pow(c - 1, 3) + s * Math.pow(c - 1, 2) }
function hash(a: number, b = 0): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca77)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const W = REEL.w, H = REEL.h

// ---- the Z, as outline points (mark units, y up) and as a pixel mask --------------------------------------------------
type Half = { outline: string[] }
const verts = zMark.vertices as unknown as Record<string, number[]>
const HALVES = [zMark.halves.top as Half, zMark.halves.bottom as Half]
const ZB = (() => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const h of HALVES) for (const n of h.outline) { const v = verts[n]; x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]); y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]) }
  return { x0, x1, y0, y1 }
})()
/** Maps the Z into a box of height h centred at (cx, cy). */
function zMap(h: number, cx: number, cy: number) {
  const s = h / (ZB.y1 - ZB.y0)
  return (v: number[]): [number, number] => [cx + (v[0] - (ZB.x0 + ZB.x1) / 2) * s, cy - (v[1] - (ZB.y0 + ZB.y1) / 2) * s]
}
function zPath(g: Ctx, half: Half, m: (v: number[]) => [number, number]) {
  half.outline.forEach((n, i) => { const [x, y] = m(verts[n]); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y) })
  g.closePath()
}
let zCells: { x: number; y: number; half: number; order: number }[] | null = null
const PX = { cols: 30, rows: 30, cell: 17 }
function getZCells() {
  if (zCells) return zCells
  const c = document.createElement('canvas')
  c.width = PX.cols
  c.height = PX.rows
  const g = c.getContext('2d', { willReadFrequently: true })!
  const m = zMap(PX.rows * 0.92, PX.cols / 2, PX.rows / 2)
  HALVES.forEach((h, i) => { g.beginPath(); zPath(g, h, m); g.fillStyle = i === 0 ? '#ff0000' : '#00ff00'; g.fill() })
  const d = g.getImageData(0, 0, PX.cols, PX.rows).data
  const out: { x: number; y: number; half: number; order: number }[] = []
  for (let y = 0; y < PX.rows; y++) for (let x = 0; x < PX.cols; x++) {
    const k = (y * PX.cols + x) * 4
    if (d[k + 3] < 100) continue
    out.push({ x, y, half: d[k] > d[k + 1] ? 0 : 1, order: (PX.rows - y) / PX.rows * 0.7 + hash(x, y) * 0.3 })
  }
  zCells = out
  return out
}

// ---- the scenes ---------------------------------------------------------------------------------------------------------

const grid: Scene = (g, p, seed) => {
  g.fillStyle = C.ink; g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(201,204,209,0.12)'; g.lineWidth = 1
  const col = (W - 80) / 12
  for (let i = 0; i <= 12; i++) { g.beginPath(); g.moveTo(40 + i * col, 40); g.lineTo(40 + i * col, H - 40); g.stroke() }
  const blocks = [[0, 0, 8, 3], [8, 0, 4, 2], [8, 2, 4, 3], [0, 3, 4, 3], [4, 3, 4, 2], [4, 5, 4, 1], [0, 6, 12, 1]]
  const fills = [C.crimson, C.silver, C.ox, C.pearl, C.grey, C.hot, C.chrome]
  const row = (H - 80) / 7
  blocks.forEach(([cx, cy, cw, ch], i) => {
    const k = backOut((p - i * 0.06) / 0.35)
    if (k <= 0) return
    const dx = (hash(seed, i) - 0.5) * 500 * (1 - k), dy = (hash(seed, i + 9) - 0.5) * 300 * (1 - k)
    g.globalAlpha = clamp01(k * 1.5)
    g.fillStyle = fills[(i + seed) % fills.length]
    g.fillRect(40 + cx * col + 6 + dx, 40 + cy * row + 6 + dy, cw * col - 12, ch * row - 12)
    g.globalAlpha = 1
  })
  g.fillStyle = C.pearl; g.font = `20px ${MONO}`
  g.fillText('GRID 12 COL · GUTTER 12', 48, H - 52)
}

const swatches: Scene = (g, p) => {
  g.fillStyle = C.pearl; g.fillRect(0, 0, W, H)
  const sw: [string, string][] = [[C.crimson, 'C4010D'], [C.ox, '5A0614'], ['#800020', '800020'], [C.chrome, 'C9CCD1'], [C.ink, '0A0A0A']]
  const bw = W / sw.length
  sw.forEach(([col, hex], i) => {
    const k = easeOut((p - i * 0.07) / 0.3)
    const y = H * (1 - k)
    g.fillStyle = col; g.fillRect(i * bw, y, bw + 1, H)
    g.fillStyle = i >= 3 ? (i === 4 ? C.pearl : C.ink) : C.pearl
    g.font = `26px ${MONO}`; g.fillText('#' + hex, i * bw + 18, y + H - 40)
  })
}

const vector: Scene = (g, p) => {
  g.fillStyle = C.silver; g.fillRect(0, 0, W, H)
  const m = zMap(H * 0.7, W / 2, H / 2)
  const pts: [number, number][] = []
  for (const h of HALVES) { for (const n of h.outline) pts.push(m(verts[n])); pts.push(m(verts[h.outline[0]])) }
  const n = Math.max(1, Math.floor(pts.length * clamp01(p * 1.15)))
  g.strokeStyle = C.crimson; g.lineWidth = 5; g.beginPath()
  pts.slice(0, n + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.stroke()
  pts.slice(0, n + 1).forEach(([x, y]) => { g.fillStyle = '#fff'; g.fillRect(x - 6, y - 6, 12, 12); g.strokeStyle = C.crimson; g.lineWidth = 2; g.strokeRect(x - 6, y - 6, 12, 12) })
  const [hx, hy] = pts[Math.min(n, pts.length - 1)]
  g.strokeStyle = C.ink; g.lineWidth = 1.5; g.beginPath(); g.moveTo(hx - 60, hy - 30); g.lineTo(hx + 60, hy + 30); g.stroke()
  g.fillStyle = C.ink; for (const s of [-1, 1]) { g.beginPath(); g.arc(hx + s * 60, hy + s * 30, 6, 0, Math.PI * 2); g.fill() }
  g.font = `20px ${MONO}`; g.fillText(`PEN TOOL · ${n} / ${pts.length} ANCHORS`, 40, H - 40)
}

const pixels: Scene = (g, p) => {
  g.fillStyle = C.ink; g.fillRect(0, 0, W, H)
  const cells = getZCells()
  const ox = W / 2 - (PX.cols * PX.cell) / 2, oy = H / 2 - (PX.rows * PX.cell) / 2
  g.strokeStyle = 'rgba(201,204,209,0.08)'
  for (let i = 0; i <= PX.cols; i++) { g.beginPath(); g.moveTo(ox + i * PX.cell, oy); g.lineTo(ox + i * PX.cell, oy + PX.rows * PX.cell); g.stroke() }
  for (const c of cells) {
    if (c.order > p * 1.25) continue
    g.fillStyle = c.half === 0 ? (hash(c.x, c.y + 3) > 0.5 ? C.chrome : '#eef0f3') : (hash(c.x, c.y + 5) > 0.5 ? C.crimson : C.ox)
    g.fillRect(ox + c.x * PX.cell + 1, oy + c.y * PX.cell + 1, PX.cell - 2, PX.cell - 2)
  }
  g.fillStyle = C.chrome; g.font = `20px ${MONO}`
  g.fillText(`RASTERISE · 35 MM · ${Math.round(clamp01(p * 1.25) * 100)}%`, 40, H - 40)
}

const type: Scene = (g, p) => {
  g.fillStyle = C.crimson; g.fillRect(0, 0, W, H)
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const L = letters[Math.floor(p * 40) % 26]
  g.fillStyle = C.pearl; g.font = `400px ${ANTON}`; g.textBaseline = 'alphabetic'
  g.fillText(L + L.toLowerCase(), 40, H - 90)
  g.font = `24px ${MONO}`
  ;['ANTON 400', 'GEIST MONO', 'CAVEAT', 'DEPARTURE MONO'].forEach((s, i) => {
    g.globalAlpha = clamp01((p - i * 0.12) * 4); g.fillText(s, W - 300, 120 + i * 50); g.globalAlpha = 1
  })
  g.fillRect(W - 300, 330, 240 * easeOut(p * 1.4), 3)
}

const ui: Scene = (g, p) => {
  g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, W, H)
  const step = (i: number) => easeOut((p - i * 0.08) / 0.25)
  g.fillStyle = C.ink; g.fillRect(0, 0, W * step(0), 56)
  g.fillStyle = C.pearl; g.font = `18px ${MONO}`
  if (step(1) > 0.5) ['WORK', 'SERVICES', 'PROCESS', 'CONTACT'].forEach((s, i) => g.fillText(s, W - 470 + i * 110, 34))
  g.fillStyle = C.ink; g.font = `58px ${ANTON}`
  const words = 'ZUHAYR CREATIVE IS A DESIGN-LED HOUSE'.split(' ')
  let x = 48
  words.forEach((w, i) => { if (step(2 + i * 0.5) <= 0) return; g.globalAlpha = step(2 + i * 0.5); g.fillText(w, x, 170 + (i > 3 ? 70 : 0) - (i > 3 ? 0 : 0)); x += g.measureText(w + ' ').width; if (i === 3) x = 48; g.globalAlpha = 1 })
  const b = step(6)
  g.fillStyle = C.crimson; g.fillRect(48, 300, 220 * b, 60)
  g.fillStyle = '#fff'; g.font = `22px ${MONO}`; if (b > 0.8) g.fillText("LET'S TALK →", 70, 338)
  for (let i = 0; i < 3; i++) { const k = step(7 + i * 0.6); g.fillStyle = [C.silver, C.ox, C.chrome][i]; g.fillRect(48 + i * 320, 400 + (1 - k) * 200, 300, 200 * k) }
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const dither: Scene = (g, p) => {
  const cell = 16
  const inks = [C.ink, C.ox, C.crimson, C.pearl]
  for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) {
    const l = clamp01(((x + p * 900) % (W * 1.2)) / (W * 1.2) * 0.9 + Math.sin(y * 0.01 + p * 6) * 0.08)
    const b = (BAYER[((y / cell) % 4) * 4 + ((x / cell) % 4)] + 0.5) / 16
    g.fillStyle = inks[Math.min(3, Math.floor(l * 3 + b))]
    g.fillRect(x, y, cell - 1, cell - 1)
  }
  g.fillStyle = C.pearl; g.font = `20px ${MONO}`; g.fillText('ORDERED DITHER · BAYER 4×4', 40, H - 40)
}

const kinetic: Scene = (g, p) => {
  g.fillStyle = C.ink; g.fillRect(0, 0, W, H)
  const words: [string, string][] = [['PAINT', C.pearl], ['→', C.crimson], ['PIXEL', C.crimson]]
  const i = Math.min(2, Math.floor(p * 3))
  const k = backOut((p * 3 - i) / 0.5)
  g.save(); g.translate(W / 2, H / 2 + 60); g.scale(0.4 + 0.6 * k, 0.4 + 0.6 * k)
  g.fillStyle = words[i][1]; g.font = `250px ${ANTON}`; g.textAlign = 'center'; g.fillText(words[i][0], 0, 0)
  g.restore(); g.textAlign = 'left'
}

const logo: Scene = (g, p) => {
  g.fillStyle = C.silver; g.fillRect(0, 0, W, H)
  const k = backOut(p / 0.45)
  const m = zMap(H * 0.62 * (0.6 + 0.4 * k), W / 2, H / 2)
  HALVES.forEach((h, i) => { g.beginPath(); zPath(g, h, m); g.fillStyle = i === 0 ? '#eef0f3' : C.crimson; g.fill(); g.strokeStyle = i === 0 ? '#9a9da3' : C.ox; g.lineWidth = 2; g.stroke() })
  g.strokeStyle = C.ink; g.lineWidth = 2
  for (const [x, y, sx, sy] of [[60, 60, 1, 1], [W - 60, 60, -1, 1], [60, H - 60, 1, -1], [W - 60, H - 60, -1, -1]]) {
    g.beginPath(); g.moveTo(x, y + sy * 30); g.lineTo(x, y); g.lineTo(x + sx * 30, y); g.stroke()
  }
}

const chart: Scene = (g, p) => {
  g.fillStyle = C.ink; g.fillRect(0, 0, W, H)
  const n = 14
  for (let i = 0; i < n; i++) {
    const v = 0.15 + 0.8 * Math.pow((i + 1) / n, 1.6) * (0.85 + 0.3 * hash(i, 4))
    const k = easeOut((p - i * 0.03) / 0.4)
    const bw = (W - 120) / n
    g.fillStyle = i === n - 1 ? C.crimson : C.grey
    g.fillRect(60 + i * bw + 4, H - 80 - v * (H - 200) * k, bw - 8, v * (H - 200) * k)
  }
  g.fillStyle = C.pearl; g.font = `52px ${ANTON}`
  g.fillText(`SEARCH GROWTH +${Math.round(248 * easeOut(p * 1.3))}%`, 60, 100)
}

const glitch: Scene = (g, p, seed) => {
  g.fillStyle = C.ink; g.fillRect(0, 0, W, H)
  const f = Math.floor(p * 14)
  g.font = `120px ${ANTON}`; g.textAlign = 'center'
  ;[[C.crimson, -1], [C.chrome, 1], [C.pearl, 0]].forEach(([col, s]) => {
    g.fillStyle = col as string
    g.fillText('ZUHAYR', W / 2 + (s as number) * (hash(f, seed) * 18), H / 2 - 10 + (hash(f + 3, seed) - 0.5) * 8)
    g.fillText('CREATIVE', W / 2 - (s as number) * (hash(f + 7, seed) * 18), H / 2 + 110)
  })
  g.textAlign = 'left'
  g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2)
  for (let i = 0; i < 5; i++) { const y = hash(f, i) * H; g.drawImage(g.canvas, 0, y, W, 14, (hash(f, i + 20) - 0.5) * 60, y, W, 14) }
}

const bezier: Scene = (g, p) => {
  g.fillStyle = '#141416'; g.fillRect(0, 0, W, H)
  const a = p * Math.PI * 2
  const P0: [number, number] = [120, H - 140], P3: [number, number] = [W - 120, 140]
  const P1: [number, number] = [380 + Math.cos(a) * 120, 120 + Math.sin(a) * 80], P2: [number, number] = [W - 380 + Math.cos(a + 2) * 120, H - 120 + Math.sin(a + 2) * 80]
  g.strokeStyle = C.crimson; g.lineWidth = 14; g.lineCap = 'round'
  g.beginPath(); g.moveTo(...P0); g.bezierCurveTo(...P1, ...P2, ...P3); g.stroke()
  g.strokeStyle = C.chrome; g.lineWidth = 2
  for (const [A, B] of [[P0, P1], [P3, P2]]) { g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.stroke(); g.fillStyle = C.chrome; g.beginPath(); g.arc(B[0], B[1], 9, 0, Math.PI * 2); g.fill() }
  for (const P of [P0, P3]) { g.fillStyle = '#fff'; g.fillRect(P[0] - 9, P[1] - 9, 18, 18) }
  g.lineCap = 'butt'
}

const SITE_SHOTS = ['site-1-hero', 'site-2-ai', 'site-3-services', 'site-4-work', 'site-5-talk'] as const
const SITE_PATH = ['', '#services', '#services', '#work', 'contact'] as const
/** The captures, loaded once by the first ScreenReel (they draw as a dark red frame until they arrive). */
const siteImgs: HTMLImageElement[] = []
function loadSites() {
  if (siteImgs.length) return
  for (const n of SITE_SHOTS) {
    const im = new Image()
    im.decoding = 'async'
    im.src = a(`laptop/${n}.jpg`)
    siteImgs.push(im)
  }
}
function arrow(g: Ctx, x: number, y: number) {
  g.beginPath()
  g.moveTo(x, y); g.lineTo(x, y + 22); g.lineTo(x + 6, y + 17); g.lineTo(x + 10, y + 26); g.lineTo(x + 14, y + 24); g.lineTo(x + 10, y + 15); g.lineTo(x + 17, y + 15)
  g.closePath()
  g.fillStyle = '#ffffff'; g.fill()
  g.strokeStyle = C.ink; g.lineWidth = 1.5; g.stroke()
}
/** One section of the live site in a browser window: it scrolls in, pushes in slowly, and a cursor goes and clicks. */
function siteScene(i: number): Scene {
  return (g, p) => {
    const TOP = 34 // under the reel's HUD bar
    const BAR = 44
    g.fillStyle = '#0e0e10'; g.fillRect(0, 0, W, H)
    g.fillStyle = '#1b1b1e'; g.fillRect(0, TOP, W, BAR)
    ;[C.crimson, C.chrome, C.pearl].forEach((c, k) => { g.fillStyle = c; g.beginPath(); g.arc(22 + k * 20, TOP + BAR / 2, 6, 0, Math.PI * 2); g.fill() })
    g.fillStyle = '#2a2a2e'
    g.beginPath(); g.roundRect(100, TOP + 10, W - 200, 24, 12); g.fill()
    g.fillStyle = '#e8e9ec'; g.font = `15px ${MONO}`; g.textAlign = 'left'
    g.fillText(`zuhayrcreative.org/${SITE_PATH[i]}`, 118, TOP + 27)
    const y0 = TOP + BAR
    const ch = H - y0
    g.save()
    g.beginPath(); g.rect(0, y0, W, ch); g.clip()
    const im = siteImgs[i]
    if (im && im.complete && im.naturalWidth > 0) {
      const s = Math.max(W / im.naturalWidth, ch / im.naturalHeight) * (1 + 0.06 * easeOut(p))
      const dw = im.naturalWidth * s, dh = im.naturalHeight * s
      const slide = ch * (1 - easeOut(p / 0.25))
      g.drawImage(im, (W - dw) / 2, y0 + (ch - dh) / 2 + slide, dw, dh)
    } else {
      g.fillStyle = '#2a0a10'; g.fillRect(0, y0, W, ch)
    }
    g.restore()
    // The cursor drifts in and clicks.
    const k = easeOut((p - 0.3) / 0.5)
    const cx = W * 0.72 + (W * 0.46 - W * 0.72) * k
    const cy = H * 0.82 + (H * 0.56 - H * 0.82) * k
    if (p > 0.82) {
      const u = (p - 0.82) / 0.18
      g.strokeStyle = `rgba(196,1,13,${1 - u})`; g.lineWidth = 3
      g.beginPath(); g.arc(cx, cy, 6 + 40 * u, 0, Math.PI * 2); g.stroke()
    }
    arrow(g, cx, cy)
  }
}

const SCENES: [string, Scene][] = [
  ['LAYOUT', grid], ['SWATCH', swatches], ['VECTOR', vector], ['RASTER', pixels], ['TYPE', type], ['WEB', ui],
  ['DITHER', dither], ['KINETIC', kinetic], ['MARK', logo], ['SEO', chart], ['GLITCH', glitch], ['CURVE', bezier],
  ['SITE · HOME', siteScene(0)], ['SITE · AI', siteScene(1)], ['SITE · SERVICES', siteScene(2)], ['SITE · WORK', siteScene(3)], ['SITE · TALK', siteScene(4)],
]

// 29 cuts: the twelve graphics (most twice) and the five site sections (longer), with showreel rhythm, filling one loop.
const CUTS = (() => {
  const order = [12, 0, 7, 2, 1, 13, 10, 3, 5, 14, 8, 4, 11, 15, 6, 9, 2, 0, 16, 7, 3, 10, 1, 8, 5, 11, 4, 9, 6]
  const rhythm = [0.5, 0.45, 0.9, 0.5, 0.35, 0.8, 0.6, 0.45, 0.85, 0.5, 0.7, 0.55]
  const durs = order.map((s, i) => (s >= 12 ? 1.15 : rhythm[i % rhythm.length]))
  const sum = durs.reduce((x, y) => x + y, 0)
  let t = 0
  return order.map((s, i) => { const d = (durs[i] / sum) * LOOP; const c = { scene: s, t0: t, d, seed: i }; t += d; return c })
})()

export class ScreenReel {
  readonly canvas: HTMLCanvasElement
  readonly texture: CanvasTexture
  private g: Ctx
  private last = -1
  constructor() {
    loadSites()
    this.canvas = document.createElement('canvas')
    this.canvas.width = W
    this.canvas.height = H
    this.g = this.canvas.getContext('2d')!
    this.texture = new CanvasTexture(this.canvas)
    this.texture.colorSpace = SRGBColorSpace
    this.texture.generateMipmaps = false // re-uploaded ~12x a second: no mip chain to rebuild
    this.texture.minFilter = LinearFilter
  }
  /** Draws the reel at loop time t (quantised to the reel's frame rate); returns true when the texture changed. */
  draw(t: number): boolean {
    const frame = Math.floor(t * REEL.fps)
    if (frame === this.last) return false
    this.last = frame
    const tq = frame / REEL.fps
    let ci = CUTS.findIndex((c) => tq < c.t0 + c.d)
    if (ci < 0) ci = CUTS.length - 1
    const cut = CUTS[ci]
    const p = clamp01((tq - cut.t0) / cut.d)
    const g = this.g
    g.save()
    g.textBaseline = 'alphabetic'
    g.textAlign = 'left'
    SCENES[cut.scene][1](g, p, cut.seed)
    g.restore()
    // A one-frame white flash on each cut, like a cut in a reel.
    if (tq - cut.t0 < 1 / REEL.fps) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, W, H) }
    // HUD: the reel's own label, timecode and progress.
    g.fillStyle = 'rgba(14,14,16,0.78)'; g.fillRect(0, 0, W, 34)
    g.fillStyle = C.crimson; g.beginPath(); g.arc(20, 17, 6, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#e8e9ec'; g.font = `16px ${MONO}`; g.textAlign = 'left'
    g.fillText(`ZC / REEL — ${String(ci + 1).padStart(2, '0')} ${SCENES[cut.scene][0]}`, 36, 23)
    g.textAlign = 'right'
    const fr = frame % REEL.fps
    g.fillText(`00:00:${String(Math.floor(tq)).padStart(2, '0')}:${String(fr).padStart(2, '0')}`, W - 16, 23)
    g.textAlign = 'left'
    g.fillStyle = C.crimson; g.fillRect(0, H - 5, W * (tq / LOOP), 5)
    this.texture.needsUpdate = true
    return true
  }
  dispose() { this.texture.dispose() }
}
