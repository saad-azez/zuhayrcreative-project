// Every tunable look value for "Paint to Pixel" lives here so the lead can tune it in one place.
// Placement and timing live in layout.ts.
type T3 = readonly [number, number, number]
export type SpotCfg = { mount: 'track' | 'jamb'; pos: T3; target: T3; angle: number; penumbra: number; intensity: number; color: string; shadow: boolean; beam: number; reach?: number }

export const LOOK = {
  bg: '#0a0a0a',
  camera: { fov: 30, pos: [0.35, 1.6, 7.6] as T3, target: [-0.12, 1.45, -1.0] as T3, minDistFit: 2.95, scrollDolly: 1.2, parallax: [0.12, 0.06] as const, damp: 2.5 },
  // The box hovers (17 Oct, the user: "the atelier box hovers gently with the cursor"): it leans toward the pointer about its own
  // centre, drifts a few cm after it, and breathes on its own (a slow bob and roll). CameraRig applies it as the inverse transform
  // on the camera, so nothing in the world moves (raycasts, clipping, the mirror stay exact). Zero for a capture / reduced motion.
  hover: { pivot: [0, 1.5, -0.95] as T3, yaw: 0.055, pitch: 0.035, shift: [0.05, 0.03] as const, bob: 0.022, bobPeriod: 6.2, roll: 0.006, rollPeriod: 9.4, follow: 0.45 },
  env: { hdri: 'hdri/studio.hdr', intensity: 0.3, softbox: 4.0, stripWhite: 4.0, stripCrimson: 5.0 },

  // Lights (warm, ~3200 K halogen; 11 Oct, the user: "spotlights warm not cool"): every visible lamp head is a real spot light (Lights.tsx draws the heads from these same numbers).
  // mount 'track' = the ceiling track (heads hang on stems), 'jamb' = the side bars standing in the opening's jambs.
  // keyL / keyR cross onto the tubes and throw their shadows down the silver paper; hero pins the Z on its turntable;
  // the jamb heads rim the tubes from the sides and pick out the desk props. beam = the faint visible cone in the air.
  // reach = the light's cut-off distance: the rims stop before they graze the far side of the silver paper (a glare in the mirror).
  spots: {
    keyL: { mount: 'track', pos: [-1.1, 2.95, -0.25], target: [-0.25, 1.55, -1.05], angle: 0.42, penumbra: 0.55, intensity: 70, color: '#ffd2a1', shadow: true, beam: 1 },
    hero: { mount: 'track', pos: [0, 2.95, -0.25], target: [0, 0.45, -0.68], angle: 0.3, penumbra: 0.5, intensity: 55, color: '#ffd9b0', shadow: true, beam: 1 },
    keyR: { mount: 'track', pos: [1.1, 2.95, -0.25], target: [0.25, 1.4, -1.05], angle: 0.42, penumbra: 0.55, intensity: 70, color: '#ffd2a1', shadow: true, beam: 1 },
    topL: { mount: 'jamb', pos: [-2.36, 2.85, -0.15], target: [-0.9, 2.0, -1.05], angle: 0.26, penumbra: 0.6, intensity: 28, color: '#ffd6a8', shadow: false, beam: 0.7 },
    topR: { mount: 'jamb', pos: [2.36, 2.85, -0.15], target: [0.9, 2.0, -1.05], angle: 0.26, penumbra: 0.6, intensity: 28, color: '#ffd6a8', shadow: false, beam: 0.7 },
    rimL: { reach: 3.0, mount: 'jamb', pos: [-2.36, 1.95, -0.15], target: [-0.35, 1.7, -1.05], angle: 0.3, penumbra: 0.7, intensity: 44, color: '#ffdcb4', shadow: false, beam: 0.6 },
    rimR: { reach: 3.0, mount: 'jamb', pos: [2.36, 1.95, -0.15], target: [0.35, 1.7, -1.05], angle: 0.3, penumbra: 0.7, intensity: 44, color: '#ffdcb4', shadow: false, beam: 0.6 },
    lowL: { mount: 'jamb', pos: [-2.36, 1.0, -0.15], target: [-1.7, 0.15, -0.5], angle: 0.36, penumbra: 0.7, intensity: 11, color: '#ffcd96', shadow: false, beam: 0.5 },
    lowR: { mount: 'jamb', pos: [2.36, 1.0, -0.15], target: [1.75, 0.35, -0.95], angle: 0.36, penumbra: 0.7, intensity: 16, color: '#ffcd96', shadow: false, beam: 0.5 },
  } satisfies Record<string, SpotCfg>,
  /** The visible beams: peak opacity of the faint additive cones, and the lit lens glow (HDR, so bloom catches it). */
  beams: { opacity: 0.07, lens: 2.6 },

  // Surfaces. tile = metres covered by one texture tile.
  paper: { tint: '#d3d6db', metalness: 0.45, roughness: 0.62, normalScale: 0.35, envMapIntensity: 0.6, tile: 1.2 },
  // The box itself: dark red brushed metal (brand maroon/crimson family), Metal032 brushed normal + roughness.
  boxMetal: {
    frame: '#7d0e1f', wall: '#6a0b1a', ceiling: '#3a0710',
    roughness: 0.3, wallRoughness: 0.42, ceilingRoughness: 0.55,
    clearcoat: 0.5, clearcoatRoughness: 0.14, normalScale: 0.5, envMapIntensity: 1.4, tile: 1.0,
  },
  marble: { normalScale: 0.4, envMapIntensity: 0.4, tile: 1.6, mirror: 0.5, mixStrength: 0.8 },
  mirror: { tint: [0.9, 0.9, 0.88] as T3, resolution: [1536, 2048] as const, clipBias: 0.003 },
  chrome: { color: '#ffffff', roughness: 0.04, envMapIntensity: 2.2 },
  crimsonMetal: { color: '#7a000f', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.6 },
  blackPlastic: { color: '#0c0c0c', roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.1 },

  // The four paints (rope, voxels, flying pixels share one material per paint).
  paints: {
    pearl: { color: '#f1ebdf', metalness: 0, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.6, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 420] as const, envMapIntensity: 1.2 },
    crimson: { color: '#c4010d', metalness: 0, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0, iridescenceIOR: 1.3, iridescenceThicknessRange: [100, 400] as const, envMapIntensity: 1.2 },
    oxblood: { color: '#5a0614', metalness: 0, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0, iridescenceIOR: 1.3, iridescenceThicknessRange: [100, 400] as const, envMapIntensity: 1.2 },
    chrome: { color: '#eef0f3', metalness: 1, roughness: 0.12, clearcoat: 0, clearcoatRoughness: 0, iridescence: 0, iridescenceIOR: 1.3, iridescenceThicknessRange: [100, 400] as const, envMapIntensity: 2.6 },
  },

  // Tube bodies: printed lacquer over crumpled aluminium (Foil003 normal + roughness).
  tubeWrap: { metalness: 0.15, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.08, normalScale: 0.6, clearcoatNormalScale: 0.4, envMapIntensity: 1.0, foilRepeat: [2, 1.75] as const },
  tubeMetal: { color: '#d4d7db', roughness: 0.28, envMapIntensity: 1.3 },

  scan: { color: '#ff3a55', lineGain: 12, sheetOpacity: 0.12 },
  motes: { count: 380, size: 0.007, opacity: 0.7 },
  dof: { target: [0, 0.9, -0.68] as T3, range: 2.6, bokeh: 1.2 },
  post: { aoRadius: 0.4, aoIntensity: 2.2, bloom: 0.35, bloomThreshold: 0.9, vignetteOffset: 0.3, vignetteDarkness: 0.55 },
} as const
