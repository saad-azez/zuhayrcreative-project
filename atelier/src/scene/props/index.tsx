import { BrushJar, LyingPencil } from './BrushJar'
import { Archive } from './Archive'
import { Desk } from './Desk'
import { FanDeck } from './FanDeck'
import { FloorNotebook } from './FloorNotebook'
import { FlyingBrush } from './FlyingBrush'
import { PixelCursor } from './PixelCursor'
import { usePencilKit } from './Pencil'
import { CAPTURE } from '../../lib/time'
import { Optional } from '../../lib/Optional'
import { StaticBatch } from '../../lib/StaticBatch'

// The ephemera (11 Oct, the user: "more ephemera and random quirks... creative design meets digital"): the designer's corner
// (cutting mat + laptop designing this very window), a tin of wet brushes and pencils, a pencil left on the paper, a fan deck
// of the brand's colours and a giant pixel pointer at the Z. The dither sweep across the window plane is a post effect
// (effects/DitherSweep.ts).
// The Archive (17 Oct): a frosted-glass file cabinet at the front right, its drawers links to Careers / Work / Contact.
// The journal (17 Oct): the user's frozen 3D notebook on the floor, front left; a click goes to the website's NOTES page.
export function Props() {
  const pencils = usePencilKit()
  return (
    <>
      {/* Parts that never move, drawn merged (lib/StaticBatch: same pixels, far fewer draw calls). */}
      <StaticBatch>
        <Desk />
        <BrushJar />
        <LyingPencil kit={pencils} />
      </StaticBatch>
      <FanDeck />
      <Archive />
      {/* The journal loads with the window, inside its one Suspense, so it is there in the first live frame (24 Oct, the user:
          it used to load on its own and pop in seconds after the rest). A failed load still only leaves it out (Optional). */}
      {CAPTURE !== null ? (
        <FloorNotebook />
      ) : (
        <Optional name="FloorNotebook">
          <FloorNotebook />
        </Optional>
      )}
      <PixelCursor />
      <FlyingBrush />
    </>
  )
}
