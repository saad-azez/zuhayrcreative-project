import { BrushJar, LyingPencil } from './BrushJar'
import { Desk } from './Desk'
import { FanDeck } from './FanDeck'
import { FlyingBrush } from './FlyingBrush'
import { PixelCursor } from './PixelCursor'
import { usePencilKit } from './Pencil'

// The ephemera (11 Oct, the user: "more ephemera and random quirks... creative design meets digital"): the designer's corner
// (cutting mat + laptop designing this very window), a tin of wet brushes and pencils, a pencil left on the paper, a fan deck
// of the brand's colours and a giant pixel pointer at the Z. The dither sweep across the window plane is a post effect
// (effects/DitherSweep.ts).
export function Props() {
  const pencils = usePencilKit()
  return (
    <>
      <Desk />
      <BrushJar />
      <LyingPencil kit={pencils} />
      <FanDeck />
      <PixelCursor />
      <FlyingBrush />
    </>
  )
}
