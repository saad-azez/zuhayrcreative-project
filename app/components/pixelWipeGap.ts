/**
 * The seam spacer's height, in vh — the breathing room between the two
 * sections a PixelWipe sits between, and the scroll the wipe rides. Shared
 * with PixelWipeLazy, which holds this exact space in the server-rendered
 * page until the wipe itself is mounted on approach, so nothing moves when
 * it is. PixelWipe has the reasoning behind the number.
 */
export const PIXEL_WIPE_GAP_VH = 75;
