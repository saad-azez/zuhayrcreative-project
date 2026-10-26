import { a } from '../../lib/assets'

// The three brand faces for the props' canvas-drawn prints (screen, cutting mat, fan deck), loaded once. Components call
// `use(canvasFonts())` (React 19) so they suspend until the faces are ready and the prints never draw in a fallback font.
let ready: Promise<void> | null = null
export function canvasFonts(): Promise<void> {
  if (ready) return ready
  const faces = [
    new FontFace('ZC Mono', `url('${a('fonts/GeistMono.ttf')}')`),
    new FontFace('ZC Anton', `url('${a('fonts/Anton-Regular.ttf')}')`),
    new FontFace('ZC Caveat', `url('${a('fonts/Caveat.ttf')}')`),
  ]
  ready = Promise.all(faces.map((f) => f.load())).then((loaded) => {
    for (const f of loaded) document.fonts.add(f)
  })
  return ready
}
