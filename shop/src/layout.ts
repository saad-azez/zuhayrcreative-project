// "Paint to Pixel" (DESIGN.md, v2): the shared world layout and the loop timeline. Every module places itself from
// these numbers so the tubes, the streams, the voxel Z and the wall drawing always agree.
// Metres; the viewer is at +z looking toward -z; the floor is y = 0; x = 0 is the window's centre line.

export type V3 = readonly [number, number, number]

/** The window box. The opening is 5.0 x 3.1; the back wall is narrower (a raked stage). There is no glass. */
export const BOX = {
  halfW: 2.5, // opening half-width at the glass line (the box is 5.0 m wide)
  h: 3.1, // opening height = ceiling height
  glassZ: 0.02,
  backZ: -1.9,
  backHalfW: 1.9, // the back wall runs x -1.9 .. 1.9
  frame: 0.22, // portal frame width around the opening
  frameZ0: -0.05, // portal frame depth runs z -0.05 .. 0.25
  frameZ1: 0.25,
} as const

/** Side walls: each runs from (+-2.5, z 0) at the front to (+-1.9, z -1.9) at the back. */
export const SIDE = {
  len: Math.hypot(BOX.halfW - BOX.backHalfW, -BOX.backZ), // 1.992 m
  /** Splay of each side wall from the z axis (17.5 degrees). */
  splay: Math.atan2(BOX.halfW - BOX.backHalfW, -BOX.backZ),
} as const

/** The portal frame around the opening (front face at z = BOX.frameZ1 + 0.008 bevel). */
export const PORTAL = {
  outerHalfW: BOX.halfW + BOX.frame, // 2.72
  bottom: -BOX.frame, // the bottom rail runs y -0.22 .. 0
  top: BOX.h + BOX.frame, // 3.32
  faceZ: BOX.frameZ1 + 0.0095, // lettering sits a hair in front of the bevelled face
} as const

/** The photographer's seamless paper sweep: roll under the ceiling -> back wall -> cove -> floor. */
export const PAPER = {
  halfW: 1.75, // the paper is 3.5 m wide (x -1.75 .. 1.75)
  wallZ: -1.86, // the hanging part of the sweep
  rollY: 2.98, // the roll's axis height
  rollR: 0.08,
  coveR: 0.35, // the cove's radius; the flat wall ends at y = coveR, the flat floor starts at z = wallZ + coveR
  frontZ: -0.1, // the paper's front edge on the floor
  color: '#d3d6db', // brand Liquid Chrome, a silver sweep
} as const

/**
 * The ink layer drawn on the hanging paper (scripts/wall/): a 4096 x 3392 texture spanning the paper's full width. The drawing keeps its 2.9 m width, centred on the wider paper.
 * Pixel (0, 0) is the top-left corner: world x = x0, y = y1.
 */
export const INK = {
  w: 4096,
  h: 3392,
  x0: -1.45,
  x1: 1.45,
  y0: 0.45,
  y1: 0.45 + (2 * 1.45 * 3392) / 4096, // 2.8516
} as const
/** World (x, y) on the hanging paper -> ink pixel. */
export const inkPx = (x: number, y: number): [number, number] => [
  ((x - INK.x0) / (INK.x1 - INK.x0)) * INK.w,
  ((INK.y1 - y) / (INK.y1 - INK.y0)) * INK.h,
]

/** The black marble turntable the Z is printed on. */
export const TURNTABLE = { x: 0, z: -0.68, r: 0.6, h: 0.12 } as const

/** The Z mark (data/z-mark.json, 1.298 m tall at scale 1) printed 0.9 m tall standing on the turntable. */
const ZS = 0.9 / 1.298
export const ZMARK = {
  scale: ZS,
  /** The Z group's origin (the mark's centre) in world space; the mark faces +z. */
  pos: [0, TURNTABLE.h + 0.649 * ZS, TURNTABLE.z] as V3,
  /** Voxel cell (the "pixel"): 3.5 cm cubes. */
  cell: 0.035,
  /** Voxel slab depth behind the front facets. */
  slab: 0.07,
  /** The finished mark's sheet thickness in world metres (the mark's own data says 0.035 at scale 1). */
  thickness: 0.05,
} as const

/**
 * Paint tubes at 10x, drawn 1.25x larger again (11 Oct, the user: bigger, so the prints and the labels read). Every tube-local
 * length (len, R, and all the geometry in tubeGeometry.ts) is in unscaled metres; the world size is that times k.
 */
export const TUBE = { len: 1.0, R: 0.14, keyY: 2.48, z: -1.05, k: 1.25 } as const

export type PaintId = 'pearl' | 'crimson' | 'oxblood' | 'chrome'

export const PAINTS: Record<PaintId, { name: string; hex: string; color: string }> = {
  pearl: { name: 'Pearl White', hex: 'F4EFE3', color: '#f1ebdf' },
  crimson: { name: 'Zuhayr Crimson', hex: 'C4010D', color: '#c4010d' },
  oxblood: { name: 'Oxblood', hex: '5A0614', color: '#5a0614' },
  chrome: { name: 'Liquid Chrome', hex: 'C9CCD1', color: '#c9ccd1' },
}

export type TubeDef = {
  index: number
  id: string
  service: string
  serviceFull: string
  paint: PaintId
  print: 'toile' | 'damask' | 'egypt' | 'durer'
  credit: string
  /** The key axis centre (where the rolled crimp is), world. */
  key: V3
  /** Rotation about z: + leans the nozzle toward +x. The fan's tops spread, the nozzles converge. */
  tilt: number
  /** Which end of the key carries the wing handle: -1 = local -x, +1 = local +x (always the outer side). */
  handle: -1 | 1
}

export const TUBES: readonly TubeDef[] = [
  {
    index: 0, id: '001', service: 'WEB', serviceFull: 'WEB DESIGN', paint: 'pearl', print: 'toile',
    credit: "WRAPPER: THE SWING (L'ESCARPOLETTE), OBERKAMPF MANUFACTORY, 1789 · THE MET, CC0",
    key: [-0.98, TUBE.keyY, TUBE.z], tilt: (20 * Math.PI) / 180, handle: -1,
  },
  {
    index: 1, id: '002', service: 'AI', serviceFull: 'AI AUTOMATION', paint: 'crimson', print: 'damask',
    credit: 'WRAPPER: CRIMSON SILK DAMASK, ITALY, 16TH CENTURY · THE MET, CC0',
    key: [-0.32, TUBE.keyY, TUBE.z], tilt: (7 * Math.PI) / 180, handle: -1,
  },
  {
    index: 2, id: '003', service: 'SEO', serviceFull: 'SEARCH GROWTH', paint: 'oxblood', print: 'egypt',
    credit: "WRAPPER: LES MONUMENTS D'ÉGYPTE, OBERKAMPF MANUFACTORY, c. 1808 · THE MET, CC0",
    key: [0.32, TUBE.keyY, TUBE.z], tilt: (-7 * Math.PI) / 180, handle: 1,
  },
  {
    index: 3, id: '004', service: 'BRAND', serviceFull: 'BRAND SYSTEMS', paint: 'chrome', print: 'durer',
    credit: 'WRAPPER: ALBRECHT DÜRER, MELENCOLIA I, 1514 · THE MET, CC0',
    key: [0.98, TUBE.keyY, TUBE.z], tilt: (-20 * Math.PI) / 180, handle: 1,
  },
]

/** Unit direction from the key toward the nozzle (down the tube) for a tilt. */
export const tubeDir = (t: TubeDef): V3 => [Math.sin(t.tilt), -Math.cos(t.tilt), 0]

/** A point on tube t's axis, s tube-local metres from the key axis toward the nozzle (s = TUBE.len is the nozzle tip); world = s * k. */
export function tubeAxis(t: TubeDef, s: number): V3 {
  const d = tubeDir(t)
  const w = s * TUBE.k
  return [t.key[0] + d[0] * w, t.key[1] + d[1] * w, t.key[2] + d[2] * w]
}

export const nozzleTip = (t: TubeDef): V3 => tubeAxis(t, TUBE.len)

/**
 * The loop, in seconds. Everything that moves is a pure function of the loop time t in [0, LOOP), so any moment can be
 * rendered exactly (poster, review, reduced motion).
 */
export const LOOP = 16.4
export const TL = {
  /** Inner tubes (002 crimson, 003 oxblood) pour: they print the crimson (bottom) half of the Z. */
  innerPour: [1.0, 4.9] as const,
  /** Outer tubes (001 pearl, 004 chrome) pour: they print the chrome (top) half, arcing in from the sides. */
  outerPour: [3.6, 7.3] as const,
  /** The scan line rises: voxels below it give way to the true mark. */
  render: [8.6, 9.8] as const,
  /** The finished mark turns on its turntable and returns. */
  hold: [9.8, 13.0] as const,
  /** The scan runs back down: the mark de-resolves into voxels. */
  unscan: [13.0, 13.6] as const,
  /** Voxels lift off top-first and fly back up into their nozzles. */
  undo: [13.5, 15.2] as const,
  /** Poster frame, first live frame and the reduced-motion still. */
  poster: 7.0,
} as const

/** The pour window of tube t. */
export const pourOf = (t: TubeDef) => (t.index === 1 || t.index === 2 ? TL.innerPour : TL.outerPour)

/** The finished mark's turn on its turntable (radians about y): out to ~31 degrees and back during the hold, else 0. */
export function zYaw(t: number): number {
  if (t <= TL.hold[0] || t >= TL.hold[1]) return 0
  const u = (t - TL.hold[0]) / (TL.hold[1] - TL.hold[0])
  const s = Math.sin(Math.PI * u)
  return 0.55 * s * s
}
