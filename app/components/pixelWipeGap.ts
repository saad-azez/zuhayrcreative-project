/**
 * The seam spacer's height, in vh — the breathing room between the two
 * sections a PixelWipe sits between, and the scroll the wipe rides. Shared
 * with PixelWipeLazy, which holds this exact space in the server-rendered
 * page until the wipe itself is mounted on approach, so nothing moves when
 * it is. PixelWipe has the reasoning behind the number.
 */
export const PIXEL_WIPE_GAP_VH = 75;

/**
 * The brush (drawing="stroke") seam rides twice the room. Its brush has to
 * be SEEN drawing across the screen, and at 75vh a normal scroll ran the
 * whole cover past in a fraction of a second (client, 25 Sep). Slowing the
 * curtain against the scroll was tried and was wrong: it fell behind the
 * page, so the next section showed before the cover had finished, both
 * ways (client, 27 Sep). More scroll keeps the curtain locked to the page
 * and gives the brush the time. The phase shares in PixelWipe fit 150 too:
 * the outgoing section has left at p 0.40, exactly as the cover completes,
 * and the incoming one enters at p 0.60, exactly as the uncover begins.
 */
export const STROKE_WIPE_GAP_VH = 150;

export const wipeGapVh = (drawing?: "pixels" | "stroke") =>
  drawing === "stroke" ? STROKE_WIPE_GAP_VH : PIXEL_WIPE_GAP_VH;
