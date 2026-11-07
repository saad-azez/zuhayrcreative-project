// The brand logos, drawn into canvases at the size a surface needs.
//   zc-mark      the CURRENT Zuhayr Creative Z: chrome top, crimson bottom (the live site's /AI-9.png, 2000 x 2000, lossless WebP)
//   zc-wordmark  the CURRENT Zuhayr Creative lockup: that Z + UHAYR + the crimson "Creative" script (the site's hero wordmark,
//                1318 x 342, lossless WebP) — never drawn larger than its source
//   zh-full      ZUHAYR HOLDINGS: the two-tone Z, UHAYR on it, HOLDINGS below (vector master, Desktop/ZUHAYR/ZUHAYR Logos)
//   zh-z         the ZUHAYR HOLDINGS Z alone (vector master)
// The old pink faceted Zuhayr Creative logo is NOT used anywhere (11 Oct, the user: it must never be used).
import { CanvasTexture, SRGBColorSpace } from 'three'
import { a } from './assets'

export type LogoId = 'zc-mark' | 'zc-wordmark' | 'zh-full' | 'zh-z'

const FILES: Record<LogoId, string> = {
  'zc-mark': 'brand/zc-mark.webp',
  'zc-wordmark': 'brand/zc-wordmark.webp',
  'zh-full': 'brand/zh-full.svg',
  'zh-z': 'brand/zh-z.svg',
}
const isSvg = (id: LogoId) => FILES[id].endsWith('.svg')

const svgCache = new Map<string, Promise<string>>()
function svgText(id: LogoId) {
  let p = svgCache.get(id)
  if (!p) {
    p = fetch(a(FILES[id])).then((r) => r.text())
    svgCache.set(id, p)
  }
  return p
}
const imgCache = new Map<string, Promise<HTMLImageElement>>()
function rasterImage(id: LogoId) {
  let p = imgCache.get(id)
  if (!p) {
    const img = new Image()
    img.decoding = 'async'
    img.src = a(FILES[id])
    p = img.decode().then(() => img)
    imgCache.set(id, p)
  }
  return p
}

/** Natural aspect (width / height) of a logo. */
export const LOGO_ASPECT: Record<LogoId, number> = { 'zc-mark': 1, 'zc-wordmark': 1318 / 342, 'zh-full': 1, 'zh-z': 1 }

/**
 * Draws logo `id` into `ctx` inside the box (x, y, w, h), aspect kept, centred. `word` recolours the black wordmark of a vector
 * lockup (HOLDINGS). `mono` paints the whole logo in one colour (a foil / leaf / a metal-rough mask). Resolves once drawn.
 */
export async function drawLogo(
  ctx: CanvasRenderingContext2D,
  id: LogoId,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { word?: string; mono?: string } = {},
): Promise<void> {
  const asp = LOGO_ASPECT[id]
  const dw = Math.min(w, h * asp)
  const dh = dw / asp
  const dx = x + (w - dw) / 2
  const dy = y + (h - dh) / 2
  let img: HTMLImageElement
  let revoke: string | null = null
  if (isSvg(id)) {
    let svg = await svgText(id)
    const side = Math.ceil(Math.max(dw, dh))
    const extra = [opts.word ? `path:not([class]){fill:${opts.word}}` : '', opts.mono ? `*{fill:${opts.mono} !important}` : ''].join('')
    svg = svg.replace('<svg ', `<svg width="${side}" height="${side}" `)
    if (extra) svg = svg.replace('</style>', `${extra}</style>`)
    revoke = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    img = new Image()
    img.src = revoke
    await img.decode()
  } else {
    img = await rasterImage(id)
  }
  try {
    if (opts.mono && !isSvg(id)) {
      // A one-colour silhouette of a raster logo: its alpha filled with the colour.
      const c = document.createElement('canvas')
      c.width = Math.ceil(dw)
      c.height = Math.ceil(dh)
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0, c.width, c.height)
      g.globalCompositeOperation = 'source-in'
      g.fillStyle = opts.mono
      g.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(c, dx, dy, dw, dh)
    } else {
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, dx, dy, dw, dh)
    }
  } finally {
    if (revoke) URL.revokeObjectURL(revoke)
  }
}

/** A transparent texture of one logo, `px` wide (height from the logo's aspect), mipmapped, sRGB. Fills in once drawn. */
export function logoTexture(id: LogoId, px: number, opts: { word?: string; mono?: string; anisotropy?: number } = {}): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = px
  c.height = Math.round(px / LOGO_ASPECT[id])
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = opts.anisotropy ?? 8
  const ctx = c.getContext('2d')!
  void drawLogo(ctx, id, 0, 0, c.width, c.height, opts).then(() => {
    tex.needsUpdate = true
  })
  return tex
}
