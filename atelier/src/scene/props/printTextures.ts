import { CanvasTexture, SRGBColorSpace, type WebGLRenderer } from 'three'
import { canvasFonts } from './canvasFonts'

// Canvas-drawn prints for the desk props, drawn once at load in the brand's own faces (canvasFonts.ts):
// the cutting mat's grid and the fan deck's colour strips. (The laptop's screen is a live reel: screenReel.ts.)

const CRIMSON = '#c4010d'
const OXBLOOD = '#5a0614'
const PEARL = '#f4efe3'
const CHROME = '#c9ccd1'
const MONO = "'ZC Mono', ui-monospace, monospace"
const ANTON = "'ZC Anton', Impact, sans-serif"

function tex(canvas: HTMLCanvasElement, gl: WebGLRenderer): CanvasTexture {
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = gl.capabilities.getMaxAnisotropy()
  t.generateMipmaps = true
  return t
}

// ---- the cutting mat: 4096 x 2704 (1.0 x 0.66 m; one 2.2 cm square = one centimetre at the props' 2.2x scale) ----------

export function makeMatTexture(gl: WebGLRenderer): CanvasTexture {
  return tex(matCanvas(), gl)
}

/** The mat canvas, drawn after the brand faces are ready (for the dev bake page). */
export async function drawMatCanvas(): Promise<HTMLCanvasElement> {
  await canvasFonts()
  return matCanvas()
}

function matCanvas(): HTMLCanvasElement {
  const W = 4096, H = 2704
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#1f1f22'
  ctx.fillRect(0, 0, W, H)
  const cell = W / 45.45
  const m = 150
  for (let i = 0; m + i * cell <= W - m + 1; i++) {
    const x = m + i * cell
    const major = i % 5 === 0
    ctx.strokeStyle = major ? 'rgba(196,1,13,0.75)' : 'rgba(201,204,209,0.28)'
    ctx.lineWidth = major ? 5 : 2.5
    ctx.beginPath(); ctx.moveTo(x, m); ctx.lineTo(x, H - m); ctx.stroke()
    if (major) {
      ctx.fillStyle = 'rgba(214,216,220,0.85)'
      ctx.font = `44px ${MONO}`
      ctx.textAlign = 'center'
      ctx.fillText(String(i), x, m - 40)
    }
  }
  for (let j = 0; m + j * cell <= H - m + 1; j++) {
    const y = m + j * cell
    const major = j % 5 === 0
    ctx.strokeStyle = major ? 'rgba(196,1,13,0.75)' : 'rgba(201,204,209,0.28)'
    ctx.lineWidth = major ? 5 : 2.5
    ctx.beginPath(); ctx.moveTo(m, y); ctx.lineTo(W - m, y); ctx.stroke()
    if (major) {
      ctx.fillStyle = 'rgba(214,216,220,0.85)'
      ctx.font = `44px ${MONO}`
      ctx.textAlign = 'right'
      ctx.fillText(String(j), m - 30, y + 15)
    }
  }
  // 45 and 60 degree guides from the bottom-left corner.
  ctx.strokeStyle = 'rgba(201,204,209,0.22)'
  ctx.lineWidth = 3
  for (const ang of [Math.PI / 4, Math.PI / 3, Math.PI / 6]) {
    ctx.beginPath(); ctx.moveTo(m, H - m); ctx.lineTo(m + Math.cos(ang) * 4000, H - m - Math.sin(ang) * 4000); ctx.stroke()
    ctx.fillStyle = 'rgba(214,216,220,0.6)'
    ctx.font = `40px ${MONO}`
    ctx.textAlign = 'left'
    ctx.fillText(`${Math.round((ang * 180) / Math.PI)}°`, m + Math.cos(ang) * 700 + 20, H - m - Math.sin(ang) * 700)
  }
  ctx.fillStyle = 'rgba(214,216,220,0.75)'
  ctx.font = `48px ${MONO}`
  ctx.textAlign = 'right'
  ctx.fillText('ZUHAYR CREATIVE · SELF-HEALING CUTTING MAT · A3 · CM', W - m, H - 60)
  ctx.textAlign = 'left'
  ctx.fillStyle = CRIMSON
  ctx.font = `64px ${ANTON}`
  ctx.fillText('MEASURE TWICE · RENDER ONCE', m, H - 50)
  return c
}

// ---- the fan deck: 10 strips side by side, each 256 x 2048 (one strip = 0.09 x 0.72 m) -------------------------------

export type DeckStrip = { name: string; code: string; ramp: string[] }
export const DECK: DeckStrip[] = [
  { name: 'ZUHAYR CRIMSON', code: 'ZC 01', ramp: ['#fbd5d7', '#f28b91', '#e8424c', '#c4010d', '#9d000a', '#710008', '#470005'] },
  { name: 'OXBLOOD', code: 'ZC 02', ramp: ['#e9c7cc', '#c98590', '#a04456', '#7a1a2d', '#5a0614', '#40030e', '#260208'] },
  { name: 'MAROON', code: 'ZC 03', ramp: ['#ecc6d1', '#cf8199', '#a93d61', '#800020', '#660019', '#470015', '#2e000d'] },
  { name: 'HOT CRIMSON', code: 'ZC 04', ramp: ['#ffd9de', '#ffa3b0', '#ff6b80', '#ff3a55', '#ff2a45', '#dc143c', '#a80f2e'] },
  { name: 'PEARL WHITE', code: 'ZC 05', ramp: ['#ffffff', '#fbf8f2', '#f4efe3', '#e8e0cd', '#d6cbb3', '#bfb197', '#9d907a'] },
  { name: 'LIQUID CHROME', code: 'ZC 06', ramp: ['#f4f5f7', '#e1e3e7', '#c9ccd1', '#aeb2b9', '#8d9198', '#6b6f76', '#4a4d53'] },
  { name: 'GRAPHITE', code: 'ZC 07', ramp: ['#c9c9cc', '#9e9ea3', '#77777d', '#55555a', '#3a3a3e', '#26262a', '#0a0a0a'] },
  { name: 'WINE', code: 'ZC 08', ramp: ['#ead0d6', '#c9919f', '#9c5468', '#6e2a3c', '#4a1424', '#330c18', '#1a070d'] },
  { name: 'ROSE', code: 'ZC 09', ramp: ['#fff0f1', '#fbd3d8', '#f4adb7', '#ea8796', '#d9667a', '#bb4a5f', '#933447'] },
  { name: 'PIXEL RED', code: 'ZC 10', ramp: ['#ff0000', '#e00000', '#c00000', '#a00000', '#800000', '#600000', '#400000'] },
]
export const STRIP_PX = { w: 256, h: 2048 } as const

export function makeDeckTexture(gl: WebGLRenderer): CanvasTexture {
  return tex(deckCanvas(), gl)
}

/** The fan-deck atlas canvas, drawn after the brand faces are ready (for the dev bake page). */
export async function drawDeckCanvas(): Promise<HTMLCanvasElement> {
  await canvasFonts()
  return deckCanvas()
}

function deckCanvas(): HTMLCanvasElement {
  const { w, h } = STRIP_PX
  const c = document.createElement('canvas')
  c.width = w * DECK.length
  c.height = h
  const ctx = c.getContext('2d')!
  DECK.forEach((strip, k) => {
    const x0 = k * w
    ctx.fillStyle = '#fbfaf7'
    ctx.fillRect(x0, 0, w, h)
    // The rivet end (top, v = 0) is plain card with the strip's code; the chips run down to the tip.
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `30px ${ANTON}`
    ctx.textAlign = 'center'
    ctx.fillText('ZC', x0 + w / 2, 200)
    const chipH = 232
    strip.ramp.forEach((col, i) => {
      const y = 300 + i * chipH
      ctx.fillStyle = col
      ctx.fillRect(x0 + 14, y, w - 28, chipH - 64)
      ctx.fillStyle = '#2a2a2a'
      ctx.font = `19px ${MONO}`
      ctx.textAlign = 'left'
      ctx.fillText(`${strip.code}-${i + 1}`, x0 + 18, y + chipH - 38)
      ctx.textAlign = 'right'
      ctx.fillText(col.slice(1).toUpperCase(), x0 + w - 18, y + chipH - 38)
    })
    ctx.save()
    ctx.translate(x0 + w / 2, 255)
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `20px ${MONO}`
    ctx.textAlign = 'center'
    ctx.fillText(strip.name, 0, 0)
    ctx.restore()
  })
  return c
}
