// The notebook's first spread (plain booklet, faces 1 and 2): the logo's journey, drawn as the atelier wall is drawn
// (~/zuhayrcreative-3dshop/src/wall/drawWall.ts): pixel graph paper, print marks, graphite and crimson marker, the Z
// constructed. Every logo is SKETCHED from its PNG (sketchLogo), never pasted: colour becomes marker, grey and white
// become graphite hatching, the edge a pencil line struck twice. A slot with no PNG yet is drawn as an empty frame.
//
// Then the spread after it, more to come (faces 3 and 4).
//
// Run through render.mjs, which writes public/notebook-pages/plain-1.webp to plain-4.webp.

import zmark from './data/z-mark.json' with { type: 'json' }

export const PAGE_W = 1536
export const PAGE_H = 2932 // 11 x 21 cm, the notebook's regular insert

const GRAPHITE = '#3a3a3c'
const INKC = '#111111'
const CRIMSON = '#c4010d'
const OXBLOOD = '#5a0614'
const PEARL = '#f4efe3'
const CHROME = '#c9ccd1'
const WHITE = '#ffffff'
const MONO = "'NB Mono'"
const HAND = "'NB Caveat'"

/** The journey, oldest first: the flat marks down the left page (up to four), then the rendered ones in a grid on the
 *  right (up to four). The order is read from the marks themselves: flat pink, then rendered rose, crimson, chrome,
 *  and chrome over crimson, the final's own split. `file` is a PNG in logos/ (an empty frame until it exists); `year`
 *  is optional; `note` the margin note. */
export const REVS = [
  { rev: 'A', year: null, file: 'ZUHAYR CREATIVE Blank.png', note: 'the Z, alone', flat: true },
  { rev: 'B', year: null, file: 'ZUHAYR CREATIVE.png', note: '+ UHAYR', flat: true },
  { rev: 'C', year: null, file: 'ZUHAYR CREATIVE Black Text.png', note: '+ CREATIVE', flat: true },
  { rev: 'D', year: null, file: 'draft3.png', note: 'rose' },
  { rev: 'E', year: null, file: 'draft2.png', note: 'crimson' },
  { rev: 'F', year: null, file: 'draft.png', note: 'chrome' },
  { rev: 'G', year: null, file: 'draft4.png', note: 'chrome over crimson' },
]
const FLAT = REVS.filter((r) => r.flat)
const RENDERED = REVS.filter((r) => !r.flat)
const FINAL = { rev: String.fromCharCode(65 + REVS.length), year: '2026', file: 'final.webp' }

/** Deterministic hash -> [0, 1) (the wall's, so the pages are reproducible). */
function rand(a, b) {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca77)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function line(ctx, x0, y0, x1, y1) {
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
}

/** A vector anchor: white square, crimson edge (the wall's). */
function anchor(ctx, x, y, size = 14) {
  ctx.fillStyle = WHITE
  ctx.strokeStyle = CRIMSON
  ctx.lineWidth = 3
  ctx.fillRect(x - size / 2, y - size / 2, size, size)
  ctx.strokeRect(x - size / 2, y - size / 2, size, size)
}

function text(ctx, s, x, y, { font = MONO, size = 20, color = INKC, align = 'left', alpha = 1, rot = 0, base = 'alphabetic' } = {}) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.font = `${size}px ${font}`
  ctx.textAlign = align
  ctx.textBaseline = base
  ctx.fillText(s, 0, 0)
  ctx.restore()
}

/** A pencil line: struck twice, the second slightly off, running a little past its ends (a drafted line). */
function pencil(ctx, x0, y0, x1, y1, alpha = 0.55, over = 0) {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1
  const ux = (x1 - x0) / len
  const uy = (y1 - y0) / len
  ctx.strokeStyle = GRAPHITE
  ctx.lineWidth = 3.4
  ctx.globalAlpha = alpha
  line(ctx, x0 - ux * over, y0 - uy * over, x1 + ux * over, y1 + uy * over)
  ctx.globalAlpha = alpha * 0.55
  line(ctx, x0 - ux * over + 1.4, y0 - uy * over - 1, x1 + ux * over + 0.6, y1 + uy * over + 1.2)
  ctx.globalAlpha = 1
}

/** A hand-drawn arrow in marker along a quadratic curve, with its head. */
function arrow(ctx, x0, y0, cx, cy, x1, y1, color = CRIMSON) {
  ctx.strokeStyle = color
  ctx.lineWidth = 6
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.quadraticCurveTo(cx, cy, x1, y1)
  ctx.stroke()
  const ang = Math.atan2(y1 - cy, x1 - cx)
  for (const d of [(28 * Math.PI) / 180, (-28 * Math.PI) / 180]) {
    const a = ang + Math.PI + d
    line(ctx, x1, y1, x1 + Math.cos(a) * 30, y1 + Math.sin(a) * 30)
  }
  ctx.globalAlpha = 1
}

// ---- paper and the marks every sheet carries -------------------------------------------------------------------------

/** The insert's paper, with tooth: an off-white with grain and a few fibres. */
function drawPaper(ctx, seed) {
  ctx.fillStyle = '#f1eadb'
  ctx.fillRect(0, 0, PAGE_W, PAGE_H)
  const img = ctx.getImageData(0, 0, PAGE_W, PAGE_H)
  const d = img.data
  for (let y = 0; y < PAGE_H; y++) {
    for (let x = 0; x < PAGE_W; x++) {
      const i = (y * PAGE_W + x) * 4
      const n = (rand(x + seed * 7919, y) - 0.5) * 10 + (rand((x >> 3) + seed, (y >> 3) + 911) - 0.5) * 6
      d[i] += n
      d[i + 1] += n
      d[i + 2] += n * 0.9
    }
  }
  ctx.putImageData(img, 0, 0)
  ctx.strokeStyle = '#8a7f6c'
  ctx.lineWidth = 0.8
  for (let k = 0; k < 260; k++) {
    const x = rand(k, seed + 3) * PAGE_W
    const y = rand(k + 41, seed + 5) * PAGE_H
    const a = rand(k, seed + 9) * Math.PI * 2
    const l = 6 + rand(k, seed + 11) * 18
    ctx.globalAlpha = 0.06 + rand(k, seed + 13) * 0.06
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/** The pixel graph paper (the wall's, at this sheet's size): a major line every fourth cell. */
function drawGrid(ctx) {
  const cell = PAGE_W / 28
  ctx.strokeStyle = GRAPHITE
  for (let n = 0; n * cell <= PAGE_W + 1; n++) {
    const major = n % 4 === 0
    ctx.globalAlpha = major ? 0.2 : 0.1
    ctx.lineWidth = major ? 3 : 2
    line(ctx, n * cell, 0, n * cell, PAGE_H)
  }
  for (let n = 0; PAGE_H - n * cell >= 0; n++) {
    const major = n % 4 === 0
    ctx.globalAlpha = major ? 0.2 : 0.1
    ctx.lineWidth = major ? 3 : 2
    line(ctx, 0, PAGE_H - n * cell, PAGE_W, PAGE_H - n * cell)
  }
  ctx.globalAlpha = 1
}

/** Crop marks in the margin, stopping short of the art area's corners. */
function drawCropMarks(ctx) {
  ctx.strokeStyle = INKC
  ctx.lineWidth = 3
  const m = 38
  const t = 30
  for (const [x, sx] of [[m, -1], [PAGE_W - m, 1]]) {
    for (const [y, sy] of [[m, -1], [PAGE_H - m, 1]]) {
      line(ctx, x, y + sy * 4, x, y + sy * (t + 4))
      line(ctx, x + sx * 4, y, x + sx * (t + 4), y)
    }
  }
}

function registration(ctx, cx, cy, r = 20) {
  ctx.strokeStyle = INKC
  ctx.fillStyle = INKC
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  line(ctx, cx - r * 1.7, cy, cx + r * 1.7, cy)
  line(ctx, cx, cy - r * 1.7, cx, cy + r * 1.7)
  for (const a of [-Math.PI / 2, Math.PI / 2]) {
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, a, a + Math.PI / 2)
    ctx.closePath()
    ctx.fill()
  }
}

/** The colour bar down the outer edge (the wall's patches). */
function colourBar(ctx, x, y0) {
  const patches = [
    ['#1aa1d6', 'C'], ['#d11d76', 'M'], ['#f2d21b', 'Y'], ['#111111', 'K'],
    [PEARL, 'F4EFE3'], [CRIMSON, 'C4010D'], [OXBLOOD, '5A0614'], [CHROME, 'C9CCD1'],
  ]
  patches.forEach(([c, label], n) => {
    const y = y0 + n * 112
    ctx.globalAlpha = 0.95
    ctx.fillStyle = c
    ctx.fillRect(x, y, 34, 104)
    ctx.globalAlpha = 1
    ctx.strokeStyle = INKC
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, 34, 104)
    text(ctx, label, x + 52, y + 52, { size: 16, align: 'center', rot: -Math.PI / 2, base: 'middle' })
  })
}

// ---- a logo, sketched -----------------------------------------------------------------------------------------------

const loadImage = (src) =>
  new Promise((res) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = () => res(null)
    im.src = src
  })

/**
 * Draws a logo PNG into the box as a sketch, and returns the drawn bounds. Colour (hue with saturation) becomes marker
 * in that colour, laid on in streaks; grey, chrome, black and white become graphite hatching, denser where darker; every
 * edge is a pencil line struck twice.
 */
function sketchLogo(ctx, img, box, seed) {
  const s = Math.min(box.w / img.width, box.h / img.height)
  const w = Math.max(1, Math.round(img.width * s))
  const h = Math.max(1, Math.round(img.height * s))
  const ox = Math.round(box.x + (box.w - w) / 2)
  const oy = Math.round(box.y + (box.h - h) / 2)
  const src = document.createElement('canvas')
  src.width = w
  src.height = h
  const sc = src.getContext('2d', { willReadFrequently: true })
  sc.drawImage(img, 0, 0, w, h)
  const px = sc.getImageData(0, 0, w, h).data

  const shape = new Uint8Array(w * h)
  const marker = new ImageData(w, h)
  const hatch = new ImageData(w, h)
  const md = marker.data
  const hd = hatch.data
  const g = [0x3a, 0x3a, 0x3c]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2], a = px[i * 4 + 3]
      if (a < 110) continue
      shape[i] = 1
      const mx = Math.max(r, gg, b)
      const mn = Math.min(r, gg, b)
      const sat = mx ? (mx - mn) / mx : 0
      const lum = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255
      if (sat > 0.32 && mx - mn > 46) {
        // Marker: the logo's own colour, a little deeper, in diagonal streaks.
        // Posterised to a few flat tones, as marker goes down: a shaded render reads as a photo otherwise.
        const streak = 0.5 + 0.5 * Math.sin((x - y * 0.35) / 5.5 + rand(y >> 4, seed) * 6)
        const al = 0.72 + 0.16 * streak + 0.1 * rand(x, y + seed)
        const tone = (Math.round((mx / 255) * 3) / 3) / (mx / 255 || 1)
        md[i * 4] = Math.min(255, r * tone * 0.92)
        md[i * 4 + 1] = Math.min(255, gg * tone * 0.88)
        md[i * 4 + 2] = Math.min(255, b * tone * 0.88)
        md[i * 4 + 3] = 255 * Math.min(1, al)
      } else {
        // Graphite: 45 degree hatching everywhere, a cross-hatch where darker, a third pass where darkest.
        const j = rand(x >> 2, y >> 2) * 1.2
        const h1 = (x + y + j) % 10 < 1.7
        const h2 = lum < 0.62 && (x - y + 4000 + j) % 10 < 1.7
        const h3 = lum < 0.32 && (x + y + 5 + j) % 10 < 1.7
        const on = h1 || h2 || h3
        if (on) {
          hd[i * 4] = g[0]
          hd[i * 4 + 1] = g[1]
          hd[i * 4 + 2] = g[2]
          hd[i * 4 + 3] = 255 * (lum > 0.85 ? 0.28 : 0.5 + 0.2 * (1 - lum))
        }
      }
    }
  }
  // The edge: a shape pixel beside one that is not, or beside a change from marker to graphite.
  const edge = new ImageData(w, h)
  const ed = edge.data
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (!shape[i]) continue
      const isMarker = md[i * 4 + 3] > 0
      // ...or where two facets of different colour meet (a faceted mark is drawn facet by facet).
      let e = false
      for (const k of [i - 1, i + 1, i - w, i + w]) {
        if (!shape[k] || (md[k * 4 + 3] > 0) !== isMarker) e = true
        else if (k > i && Math.abs(px[i * 4] - px[k * 4]) + Math.abs(px[i * 4 + 1] - px[k * 4 + 1]) + Math.abs(px[i * 4 + 2] - px[k * 4 + 2]) > 70) e = true
      }
      if (e) {
        ed[i * 4] = isMarker ? 0x5a : g[0]
        ed[i * 4 + 1] = isMarker ? 0x06 : g[1]
        ed[i * 4 + 2] = isMarker ? 0x14 : g[2]
        ed[i * 4 + 3] = 235
      }
    }
  }
  const put = (data) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d').putImageData(data, 0, 0)
    return c
  }
  const mc = put(marker)
  const hc = put(hatch)
  const ec = put(edge)
  ctx.drawImage(mc, ox, oy)
  ctx.drawImage(hc, ox, oy)
  ctx.globalAlpha = 0.9
  for (const [ex, ey] of [[0, 0], [1, 0], [0, 1], [1, 1]]) ctx.drawImage(ec, ox + ex, oy + ey)
  ctx.globalAlpha = 0.45
  ctx.drawImage(ec, ox + 2.6, oy - 2)
  ctx.globalAlpha = 1
  return { x: ox, y: oy, w, h }
}

/** The selection box round a drawn logo, with its eight handles (the wall's). */
function selection(ctx, b, pad = 10) {
  const x0 = b.x - pad, y0 = b.y - pad, x1 = b.x + b.w + pad, y1 = b.y + b.h + pad
  ctx.strokeStyle = CRIMSON
  ctx.lineWidth = 3
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2
  for (const [hx, hy] of [[x0, y0], [mx, y0], [x1, y0], [x0, my], [x1, my], [x0, y1], [mx, y1], [x1, y1]]) anchor(ctx, hx, hy, 14)
  return { x0, y0, x1, y1, mx }
}

/** One revision: its label, its frame, the logo sketched in it (or an empty frame until its PNG comes), its note. */
async function drawRev(ctx, r, box, seed) {
  text(ctx, `REV ${r.rev}`, box.x, box.y - 18, { size: 34 })
  if (r.year) text(ctx, r.year, box.x + box.w, box.y - 18, { size: 28, color: GRAPHITE, align: 'right', alpha: 0.85 })
  // Frame: crop ticks at its corners and a faint drafted rule round it.
  ctx.strokeStyle = INKC
  ctx.lineWidth = 3
  const t = 26
  for (const [x, sx] of [[box.x, 1], [box.x + box.w, -1]]) {
    for (const [y, sy] of [[box.y, 1], [box.y + box.h, -1]]) {
      line(ctx, x, y, x + sx * t, y)
      line(ctx, x, y, x, y + sy * t)
    }
  }
  pencil(ctx, box.x, box.y, box.x + box.w, box.y, 0.28, 14)
  pencil(ctx, box.x, box.y + box.h, box.x + box.w, box.y + box.h, 0.28, 14)
  pencil(ctx, box.x, box.y, box.x, box.y + box.h, 0.28, 14)
  pencil(ctx, box.x + box.w, box.y, box.x + box.w, box.y + box.h, 0.28, 14)

  const img = r.file ? await loadImage(`logos/${r.file}`) : null
  const inner = { x: box.x + 46, y: box.y + 40, w: box.w - 92, h: box.h - 80 }
  if (img) {
    const b = sketchLogo(ctx, img, inner, seed)
    selection(ctx, b)
  } else {
    ctx.save()
    ctx.strokeStyle = GRAPHITE
    ctx.globalAlpha = 0.45
    ctx.lineWidth = 3
    ctx.setLineDash([16, 14])
    ctx.strokeRect(inner.x, inner.y, inner.w, inner.h)
    ctx.restore()
    text(ctx, `logo ${r.rev.toLowerCase()} — to be sketched`, box.x + box.w / 2, box.y + box.h / 2 + 4, { font: HAND, size: 66, color: GRAPHITE, align: 'center', alpha: 0.6, rot: -0.02 })
    text(ctx, 'PNG → PENCIL + MARKER', box.x + box.w / 2, box.y + box.h / 2 + 64, { size: 22, color: GRAPHITE, align: 'center', alpha: 0.55 })
  }
  // The margin note: what changed. A ruled line waits for it.
  const ny = box.y + box.h + 50
  if (r.note) {
    text(ctx, r.note, box.x + 6, ny, { font: HAND, size: 58, color: GRAPHITE, rot: -0.015 })
  } else {
    text(ctx, 'what changed:', box.x + 6, ny, { font: HAND, size: 54, color: GRAPHITE, alpha: 0.65, rot: -0.015 })
    ctx.save()
    ctx.strokeStyle = GRAPHITE
    ctx.globalAlpha = 0.45
    ctx.lineWidth = 2.6
    ctx.setLineDash([5, 10])
    line(ctx, box.x + 290, ny + 2, box.x + box.w - 10, ny - 4)
    ctx.restore()
  }
}

// ---- the Z, constructed (the wall's, at this sheet's size) ----------------------------------------------------------

function drawConstructedZ(ctx, cx, cy, zs) {
  const verts = zmark.vertices
  const top = zmark.halves.top
  const bottom = zmark.halves.bottom
  const g = (x, y) => [cx + x * zs, cy - y * zs]
  const gv = (n) => g(verts[n][0], verts[n][1])
  const k = zs / 652.9

  ctx.strokeStyle = GRAPHITE
  ctx.lineWidth = 2.6
  ctx.globalAlpha = 0.6
  ctx.beginPath()
  ctx.arc(cx, cy, 466 * k, 0, Math.PI * 2)
  ctx.stroke()
  line(ctx, cx - 5, cy, cx + 5, cy)
  line(ctx, cx, cy - 5, cx, cy + 5)

  ctx.globalAlpha = 0.45
  for (const half of [top, bottom]) {
    for (const tri of half.frontTriangles) {
      ctx.beginPath()
      tri.forEach((n, i) => {
        const [x, y] = gv(n)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 0.95
  ctx.lineWidth = 4.5
  for (const half of [top, bottom]) {
    ctx.beginPath()
    half.outline.forEach((n, i) => {
      const [x, y] = gv(n)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.stroke()
  }
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 2
  for (const half of [top, bottom]) {
    const n = half.outline.length
    for (let i = 0; i < n; i++) {
      const [ax, ay] = gv(half.outline[i])
      const [bx, by] = gv(half.outline[(i + 1) % n])
      const len = Math.hypot(bx - ax, by - ay)
      const ux = (bx - ax) / len, uy = (by - ay) / len
      line(ctx, ax - ux * 140 * k, ay - uy * 140 * k, bx + ux * 140 * k, by + uy * 140 * k)
    }
  }
  ctx.globalAlpha = 1
  ctx.lineWidth = 3
  const o = top.outline
  for (const name of ['A', 'B']) {
    const idx = o.indexOf(name)
    const [vx, vy] = gv(name)
    const [px, py] = gv(o[(idx + o.length - 1) % o.length])
    const [nx, ny] = gv(o[(idx + 1) % o.length])
    const a1 = Math.atan2(py - vy, px - vx)
    let d = Math.atan2(ny - vy, nx - vx) - a1
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    ctx.beginPath()
    ctx.arc(vx, vy, 40 * k, a1, a1 + d, d < 0)
    ctx.stroke()
  }
  // The right half as a selected vector path.
  ctx.strokeStyle = INKC
  ctx.lineWidth = 4
  const right = new Set()
  for (const half of [top, bottom]) {
    const n = half.outline.length
    for (let i = 0; i < n; i++) {
      const a = half.outline[i], b = half.outline[(i + 1) % n]
      if (verts[a][0] >= 0) right.add(a)
      if (verts[a][0] >= 0 && verts[b][0] >= 0) {
        const [ax, ay] = gv(a)
        const [bx, by] = gv(b)
        line(ctx, ax, ay, bx, by)
      }
    }
  }
  for (const n of right) {
    const [x, y] = gv(n)
    anchor(ctx, x, y)
  }
  const [bx0, by0] = g(-0.741, 0.649)
  const [bx1, by1] = g(0.741, -0.649)
  const b = selection(ctx, { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 }, 6)
  const pillCy = b.y1 + 50
  ctx.fillStyle = CRIMSON
  ctx.beginPath()
  ctx.roundRect(b.mx - 150, pillCy - 24, 300, 48, 24)
  ctx.fill()
  text(ctx, '1028 × 900 mm', b.mx, pillCy + 1, { size: 26, color: WHITE, align: 'center', base: 'middle' })
}

// ---- the two pages --------------------------------------------------------------------------------------------------

/** The revisions zig-zag down the left page, larger the fewer there are. */
const LEFT_SLOTS = (() => {
  const n = FLAT.length
  // Clear of the strip of the kraft cover the book's model shows along the foot of this page.
  const top = 470, bottom = 2600
  const pitch = (bottom - top) / n
  const h = Math.min(560, pitch - 190), w = Math.min(880, h * 1.8)
  return FLAT.map((_, i) => ({ x: i % 2 ? PAGE_W - 150 - w : 150, y: top + i * pitch, w, h }))
})()

export async function drawLeft(ctx) {
  drawPaper(ctx, 1)
  drawGrid(ctx)
  drawCropMarks(ctx)
  colourBar(ctx, 34, 700)
  // Title block.
  text(ctx, 'ZUHAYR CREATIVE · IDENTITY', 150, 136, { size: 28, color: GRAPHITE })
  text(ctx, 'SHEET 001', PAGE_W - 110, 136, { size: 28, color: GRAPHITE, align: 'right' })
  text(ctx, 'the mark, from the start', 140, 278, { font: HAND, size: 132, color: GRAPHITE, rot: -0.018 })
  pencil(ctx, 146, 314, 1010, 298, 0.7, 6)

  for (let i = 0; i < LEFT_SLOTS.length; i++) await drawRev(ctx, FLAT[i], LEFT_SLOTS[i], i + 1)
  // One to the next, down the page, then off towards the spine.
  for (let i = 0; i < LEFT_SLOTS.length - 1; i++) {
    const a = LEFT_SLOTS[i], b = LEFT_SLOTS[i + 1]
    // From the side of one frame, round and down to the label of the next.
    if (b.x > a.x) arrow(ctx, a.x + a.w + 26, a.y + a.h * 0.45, a.x + a.w + 150, b.y - 150, b.x + b.w - 170, b.y - 66)
    else arrow(ctx, a.x - 26, a.y + a.h * 0.45, a.x - 150, b.y - 150, b.x + 170, b.y - 66)
  }
  const last = LEFT_SLOTS[LEFT_SLOTS.length - 1]
  arrow(ctx, last.x + 140, last.y + last.h + 78, last.x + 520, last.y + last.h + 230, PAGE_W - 30, last.y + last.h + 150)
  registration(ctx, 92, PAGE_H - 92)
  text(ctx, '001', 92, PAGE_H - 46, { size: 24, color: GRAPHITE, align: 'center' })
}

export async function drawRight(ctx) {
  drawPaper(ctx, 2)
  drawGrid(ctx)
  drawCropMarks(ctx)
  colourBar(ctx, PAGE_W - 58 - 24, 700)
  text(ctx, 'ZUHAYR CREATIVE · IDENTITY', 150, 136, { size: 28, color: GRAPHITE })
  text(ctx, 'SHEET 002', PAGE_W - 110, 136, { size: 28, color: GRAPHITE, align: 'right' })
  // In from the spine, from the last of the flat ones: the rendered marks, two by two.
  arrow(ctx, 20, 190, 60, 270, 120, 290)
  text(ctx, 'then, in 3D', 140, 320, { font: HAND, size: 100, color: GRAPHITE, rot: -0.012 })
  const cw = 560, ch = 340
  const grid = RENDERED.map((_, i) => ({ x: i % 2 ? PAGE_W - 150 - cw : 150, y: 420 + Math.floor(i / 2) * 520, w: cw, h: ch }))
  for (let i = 0; i < grid.length; i++) await drawRev(ctx, RENDERED[i], grid[i], FLAT.length + i + 1)
  for (let i = 0; i < grid.length - 1; i++) {
    const a = grid[i], b = grid[i + 1]
    // Across a row; at its end, back and down to the start of the next.
    if (b.x > a.x) arrow(ctx, a.x + a.w + 20, a.y + a.h * 0.5, (a.x + a.w + b.x) / 2, a.y + a.h * 0.3, b.x - 20, b.y + b.h * 0.5)
    else arrow(ctx, a.x + 120, a.y + a.h + 80, (a.x + b.x + b.w) / 2, a.y + a.h + 60, b.x + b.w - 120, b.y - 60)
  }

  // The mark, constructed.
  const zy = 1640
  text(ctx, 'the mark,', 150, zy - 60, { font: HAND, size: 76, color: GRAPHITE, rot: -0.02 })
  text(ctx, 'constructed', 150, zy + 10, { font: HAND, size: 76, color: GRAPHITE, rot: -0.02 })
  drawConstructedZ(ctx, 900, zy, 330)

  // The final lockup, sketched like every revision before it.
  const fy = 2000
  text(ctx, `REV ${FINAL.rev} · FINAL`, 150, fy - 18, { size: 34 })
  text(ctx, FINAL.year, PAGE_W - 150, fy - 18, { size: 28, color: GRAPHITE, align: 'right', alpha: 0.85 })
  const img = await loadImage(`logos/${FINAL.file}`)
  if (img) {
    const b = sketchLogo(ctx, img, { x: 170, y: fy + 30, w: PAGE_W - 340, h: 300 }, 9)
    selection(ctx, b, 14)
  }
  text(ctx, 'final', 1000, fy + 420, { font: HAND, size: 120, color: CRIMSON, rot: -0.04 })
  ctx.strokeStyle = CRIMSON
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(1250, fy + 370)
  ctx.lineTo(1276, fy + 400)
  ctx.lineTo(1326, fy + 326)
  ctx.stroke()

  // Engineering title block, bottom right.
  const tb = { x: PAGE_W - 150 - 560, y: PAGE_H - 330, w: 560, h: 200 }
  ctx.strokeStyle = INKC
  ctx.lineWidth = 3
  ctx.strokeRect(tb.x, tb.y, tb.w, tb.h)
  line(ctx, tb.x, tb.y + 70, tb.x + tb.w, tb.y + 70)
  line(ctx, tb.x, tb.y + 135, tb.x + tb.w, tb.y + 135)
  line(ctx, tb.x + 300, tb.y + 70, tb.x + 300, tb.y + tb.h)
  text(ctx, 'ZUHAYR CREATIVE — IDENTITY', tb.x + 20, tb.y + 45, { size: 30 })
  text(ctx, 'SHEET 001–002', tb.x + 20, tb.y + 112, { size: 24, color: GRAPHITE })
  text(ctx, `REV A → ${FINAL.rev}`, tb.x + 320, tb.y + 112, { size: 24, color: GRAPHITE })
  text(ctx, 'DRAWN  Z.C.', tb.x + 20, tb.y + 177, { size: 24, color: GRAPHITE })
  text(ctx, FINAL.year, tb.x + 320, tb.y + 177, { size: 24, color: GRAPHITE })
  registration(ctx, PAGE_W - 92, PAGE_H - 92)
  text(ctx, '002', PAGE_W - 92, PAGE_H - 46, { size: 24, color: GRAPHITE, align: 'center' })
}

// ---- the next spread: more to come ----------------------------------------------------------------------------------

/** A swash under a word, in marker: one stroke out, a tighter one back. */
function swash(ctx, x0, y, x1, color = CRIMSON) {
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.9
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.moveTo(x0, y + 10)
  ctx.bezierCurveTo(x0 + (x1 - x0) * 0.3, y - 26, x0 + (x1 - x0) * 0.7, y + 30, x1, y - 8)
  ctx.stroke()
  ctx.lineWidth = 5
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.moveTo(x1 - 30, y - 2)
  ctx.bezierCurveTo(x0 + (x1 - x0) * 0.6, y + 34, x0 + (x1 - x0) * 0.25, y + 6, x0 + 60, y + 30)
  ctx.stroke()
  ctx.globalAlpha = 1
}

export async function drawSoonLeft(ctx) {
  drawPaper(ctx, 3)
  drawGrid(ctx)
  drawCropMarks(ctx)
  colourBar(ctx, 34, 700)
  text(ctx, 'ZUHAYR CREATIVE · NOTES', 150, 136, { size: 28, color: GRAPHITE })
  text(ctx, 'SHEET 003', PAGE_W - 110, 136, { size: 28, color: GRAPHITE, align: 'right' })
  // The words, large, the way they would be written across a fresh page.
  text(ctx, 'more', 210, 1180, { font: HAND, size: 330, color: GRAPHITE, rot: -0.06 })
  text(ctx, 'notes', 330, 1520, { font: HAND, size: 330, color: GRAPHITE, rot: -0.05 })
  swash(ctx, 330, 1600, 1150)
  // A few ruled lines left waiting.
  for (let n = 0; n < 6; n++) {
    const y = 1980 + n * 120
    ctx.save()
    ctx.strokeStyle = GRAPHITE
    ctx.globalAlpha = 0.4
    ctx.lineWidth = 2.6
    ctx.setLineDash([5, 12])
    line(ctx, 210, y, PAGE_W - 200, y - 6)
    ctx.restore()
  }
  registration(ctx, 92, PAGE_H - 92)
  text(ctx, '003', 92, PAGE_H - 46, { size: 24, color: GRAPHITE, align: 'center' })
}

export async function drawSoonRight(ctx) {
  drawPaper(ctx, 4)
  drawGrid(ctx)
  drawCropMarks(ctx)
  colourBar(ctx, PAGE_W - 58 - 24, 700)
  // On from the page before.
  arrow(ctx, 20, 1300, 120, 1180, 250, 1240)
  text(ctx, 'coming', 260, 1260, { font: HAND, size: 290, color: CRIMSON, rot: -0.05 })
  text(ctx, 'soon', 470, 1580, { font: HAND, size: 330, color: CRIMSON, rot: -0.04 })
  // An in-progress stamp, as a sheet still on the board carries.
  ctx.save()
  ctx.translate(1010, 2050)
  ctx.rotate(-0.08)
  ctx.strokeStyle = CRIMSON
  ctx.lineWidth = 5
  ctx.globalAlpha = 0.85
  ctx.strokeRect(-250, -70, 500, 140)
  ctx.lineWidth = 2
  ctx.strokeRect(-236, -56, 472, 112)
  ctx.restore()
  text(ctx, 'IN PROGRESS', 1010, 2062, { size: 48, color: CRIMSON, align: 'center', rot: -0.08, alpha: 0.9, base: 'middle' })
  // The title block.
  const tb = { x: PAGE_W - 150 - 560, y: PAGE_H - 330, w: 560, h: 200 }
  ctx.strokeStyle = INKC
  ctx.lineWidth = 3
  ctx.strokeRect(tb.x, tb.y, tb.w, tb.h)
  line(ctx, tb.x, tb.y + 70, tb.x + tb.w, tb.y + 70)
  line(ctx, tb.x, tb.y + 135, tb.x + tb.w, tb.y + 135)
  line(ctx, tb.x + 300, tb.y + 70, tb.x + 300, tb.y + tb.h)
  text(ctx, 'ZUHAYR CREATIVE — NOTES', tb.x + 20, tb.y + 45, { size: 30 })
  text(ctx, 'SHEET 003–004', tb.x + 20, tb.y + 112, { size: 24, color: GRAPHITE })
  text(ctx, 'REV —', tb.x + 320, tb.y + 112, { size: 24, color: GRAPHITE })
  text(ctx, 'DRAWN  Z.C.', tb.x + 20, tb.y + 177, { size: 24, color: GRAPHITE })
  text(ctx, FINAL.year, tb.x + 320, tb.y + 177, { size: 24, color: GRAPHITE })
  registration(ctx, PAGE_W - 92, PAGE_H - 92)
  text(ctx, '004', PAGE_W - 92, PAGE_H - 46, { size: 24, color: GRAPHITE, align: 'center' })
}
