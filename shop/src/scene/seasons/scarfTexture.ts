import { CanvasTexture, SRGBColorSpace } from 'three'
import { a } from '../../lib/assets'
import type { Region } from './regions'

const W = 2048
const H = 4096

let fontsReady: Promise<unknown> | null = null
/** Registers the two display faces once per page and resolves when they can be drawn with. */
function loadFonts(): Promise<unknown> {
  if (!fontsReady) {
    const anton = new FontFace('ZC Anton', `url(${a('fonts/Anton-Regular.ttf')})`)
    const mono = new FontFace('ZC Geist Mono', `url(${a('fonts/GeistMono.ttf')})`)
    document.fonts.add(anton)
    document.fonts.add(mono)
    fontsReady = Promise.all([anton.load(), mono.load(), document.fonts.load("64px 'ZC Anton'")])
  }
  return fontsReady
}

/** Places the region's own logo image (never redrawn), centred at (cx, cy), size px square, turned rot radians about its centre. */
function logo(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, size: number, rot = 0, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.drawImage(img, -size / 2, -size / 2, size, size)
  ctx.restore()
}

/**
 * A carré-style silk print composed from the region's own logo image (placed, tiled, rotated; never redrawn) on a 2048 x 4096
 * canvas (the scarf is 1 : 2). The texture is returned at once and fills in when the fonts are ready.
 */
export function makeScarfTexture(r: Region, img: HTMLImageElement, maxAniso: number): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = maxAniso

  const draw = () => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // 1. the silk ground
    ctx.fillStyle = r.silk
    ctx.fillRect(0, 0, W, H)

    // 2. the all-over repeat: small logos, every other row offset, each turned a quarter further than its neighbour
    for (let row = 0; row * 300 <= H + 300; row++) {
      for (let col = -1; col * 300 <= W + 300; col++) {
        const x = col * 300 + (row % 2 ? 150 : 0)
        logo(ctx, img, x, row * 300, 220, ((((col + row) % 4) + 4) % 4) * (Math.PI / 2), 0.16)
      }
    }

    // 3. the border band, its pearl rule and the logos running along it
    ctx.fillStyle = r.border
    ctx.fillRect(0, 0, W, 120)
    ctx.fillRect(0, H - 120, W, 120)
    ctx.fillRect(0, 0, 120, H)
    ctx.fillRect(W - 120, 0, 120, H)
    ctx.strokeStyle = '#fbfaf7'
    ctx.lineWidth = 6
    ctx.strokeRect(140, 140, W - 280, H - 280)
    for (let x = 80; x < W; x += 160) {
      logo(ctx, img, x, 60, 90)
      logo(ctx, img, x, H - 60, 90)
    }
    for (let y = 200; y < H - 150; y += 160) {
      logo(ctx, img, 60, y, 90)
      logo(ctx, img, W - 60, y, 90)
    }

    // 4. the centre medallion
    ctx.save()
    ctx.globalAlpha = 0.92
    ctx.fillStyle = r.silk
    ctx.beginPath()
    ctx.arc(1024, 2048, 700, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.strokeStyle = r.border
    ctx.lineWidth = 14
    ctx.beginPath()
    ctx.arc(1024, 2048, 700, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(1024, 2048, 660, 0, Math.PI * 2)
    ctx.stroke()
    logo(ctx, img, 1024, 2048, 1100)

    // 5. the two smaller medallion logos
    logo(ctx, img, 1024, 820, 420)
    logo(ctx, img, 1024, 3276, 420)

    // 6. the lettering
    ctx.fillStyle = r.border
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = "120px 'ZC Anton'"
    ctx.letterSpacing = '18px'
    ctx.fillText(r.city, 1024, 3780)
    ctx.font = "44px 'ZC Geist Mono'"
    ctx.letterSpacing = '0px'
    ctx.fillText(r.season + ' · ZUHAYR CREATIVE', 1024, 3860)
    tex.needsUpdate = true
  }

  loadFonts().then(draw, draw)
  return tex
}
