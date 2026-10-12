// The black satin label band printed round each tube (4096 x 1024): chrome-foil rules, the user's ZUHAYR CREATIVE logo
// (vector, public/brand), the paint's name in script with its pixel ramp, the ZUHAYR HOLDINGS mark, the service and the
// wrapper credit. Two canvases are drawn from one routine:
// albedo, and metal/rough (three.js reads roughness from G and metalness from B), so the foil lettering is metallic.
import { CanvasTexture, NoColorSpace, SRGBColorSpace } from 'three'
import { a } from '../../lib/assets'
import { PAINTS, type TubeDef } from '../../layout'
import { drawLogo } from '../../lib/logoTexture'

const W = 4096
const H = 1024

type Finish = { albedo: string; mr: string }
const SATIN: Finish = { albedo: '#0b0b0b', mr: 'rgb(0, 107, 0)' }
const FOIL: Finish = { albedo: '#d8dadd', mr: 'rgb(0, 31, 255)' }
const INK_CREAM: Finish = { albedo: '#f4efe3', mr: 'rgb(0, 90, 0)' }
const INK_GREY: Finish = { albedo: '#8a8a8a', mr: 'rgb(0, 100, 0)' }
const SCRIPT: Record<string, string> = { pearl: '#f1ebdf', crimson: '#c4010d', oxblood: '#8c1a2b' }
const PAINT_MR = 'rgb(0, 64, 0)'

// The fonts load once per page; the textures are returned at once and drawn when the fonts are ready.
let fonts: Promise<unknown> | null = null
function loadFonts() {
  if (!fonts) {
    const faces: [string, string][] = [
      ['ZC Anton', 'fonts/Anton-Regular.ttf'],
      ['ZC Geist Mono', 'fonts/GeistMono.ttf'],
      ['ZC Caveat', 'fonts/Caveat.ttf'],
    ]
    fonts = Promise.all(
      faces.map(async ([family, file]) => {
        const f = new FontFace(family, `url(${a(file)})`)
        await f.load()
        document.fonts.add(f)
      }),
    ).catch(() => undefined)
  }
  return fonts
}

const hexToRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbToHex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
/** Mixes hex colour `h` toward `to` (a 0..255 grey) by t, in sRGB hex space. */
const mixToward = (h: string, to: number, t: number) => rgbToHex(hexToRgb(h).map((v) => v + (to - v) * t))
const mixHex = (h0: string, h1: string, t: number) => {
  const c0 = hexToRgb(h0)
  const c1 = hexToRgb(h1)
  return rgbToHex(c0.map((v, i) => v + (c1[i] - v) * t))
}

type Ctx = CanvasRenderingContext2D & { letterSpacing: string }

async function draw(ctx: Ctx, mode: 'albedo' | 'mr', tube: TubeDef): Promise<void> {
  const fin = (f: Finish) => (mode === 'albedo' ? f.albedo : f.mr)
  const chrome = tube.paint === 'chrome'
  const paintFin: Finish = chrome ? FOIL : { albedo: SCRIPT[tube.paint], mr: PAINT_MR }
  const text = (s: string, font: string, spacing: number, f: Finish, align: CanvasTextAlign, x: number, y: number) => {
    ctx.font = font
    ctx.letterSpacing = `${spacing}px`
    ctx.textAlign = align
    ctx.fillStyle = fin(f)
    ctx.fillText(s, x, y)
  }

  ctx.fillStyle = fin(SATIN)
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = fin(FOIL)
  ctx.fillRect(0, 44, W, 7)
  ctx.fillRect(0, 973, W, 7)

  // The ZUHAYR CREATIVE logo, centred at the front (u = 0.5), with the tube number and service under it.
  await drawLogo(ctx, 'zc-wordmark', 1748, 170, 600, 600, mode === 'albedo' ? { word: '#e9eaec' } : { mono: 'rgb(0, 60, 0)' })
  text(`No. ${tube.id} · ${tube.serviceFull}`, "56px 'ZC Geist Mono'", 10, INK_CREAM, 'center', 2048, 862)

  // Left flank: the paint's name in script, the line under it and the pixel ramp in one row.
  text(PAINTS[tube.paint].name, "170px 'ZC Caveat'", 0, paintFin, 'right', 1690, 470)
  text('HONG KONG · 200 ML', "40px 'ZC Geist Mono'", 8, INK_GREY, 'right', 1690, 590)
  const base = PAINTS[tube.paint].color
  for (let n = 0; n < 8; n++) {
    let f: Finish
    if (chrome) f = { albedo: mixHex('#f2f3f5', '#3a3c40', n / 7), mr: FOIL.mr }
    else f = { albedo: n <= 3 ? mixToward(base, 255, (7 - n) / 10) : mixToward(base, 0, (n - 3) / 8), mr: PAINT_MR }
    ctx.fillStyle = fin(f)
    ctx.fillRect(1690 - (8 - n) * 70 + 10, 640, 60, 60)
  }

  // Right flank: the ZUHAYR HOLDINGS Z and its tag.
  await drawLogo(ctx, 'zh-z', 2400, 318, 128, 128, { mono: fin(FOIL) })
  text('A CONCERN OF', "36px 'ZC Geist Mono'", 10, INK_GREY, 'left', 2548, 372)
  text('ZUHAYR HOLDINGS', "60px 'ZC Anton'", 12, FOIL, 'left', 2548, 440)
  text('HONG KONG', "36px 'ZC Geist Mono'", 14, INK_CREAM, 'left', 2548, 500)

  text(tube.credit, "28px 'ZC Geist Mono'", 4, INK_GREY, 'center', 2048, 940)

  // The back of the band repeats so the mirror shows something.
  for (const cx of [512, 3584]) {
    await drawLogo(ctx, 'zc-mark', cx - 190, 170, 380, 380, mode === 'albedo' ? {} : { mono: 'rgb(0, 60, 0)' })
    text(`ZUHAYR CREATIVE · ${tube.id} · ${tube.service}`, "52px 'ZC Geist Mono'", 12, FOIL, 'center', cx, 700)
  }
}

export function makeLabelTextures(tube: TubeDef, maxAnisotropy: number): { map: CanvasTexture; mr: CanvasTexture } {
  const make = () => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    return c
  }
  const albedo = make()
  const mrCanvas = make()
  const ctxA = albedo.getContext('2d') as Ctx
  const ctxM = mrCanvas.getContext('2d') as Ctx
  ctxA.fillStyle = SATIN.albedo
  ctxA.fillRect(0, 0, W, H)
  ctxM.fillStyle = 'rgb(0, 0, 0)'
  ctxM.fillRect(0, 0, W, H)

  const map = new CanvasTexture(albedo)
  map.colorSpace = SRGBColorSpace
  map.anisotropy = maxAnisotropy
  const mr = new CanvasTexture(mrCanvas)
  mr.colorSpace = NoColorSpace
  mr.anisotropy = maxAnisotropy

  void loadFonts().then(async () => {
    await draw(ctxA, 'albedo', tube)
    await draw(ctxM, 'mr', tube)
    map.needsUpdate = true
    mr.needsUpdate = true
  })
  return { map, mr }
}
