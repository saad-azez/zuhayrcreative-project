"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import * as THREE from "three";
import {
  Canvas,
  useFrame,
  useLoader,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import { useSplashHover } from "./useSplashHover";
import ChromaticMetal from "./ChromaticMetal";
import { useImageTrail, TRAIL_HIDDEN_CLIP } from "@/app/animations/useImageTrail";
import type { TrailRect } from "@/app/animations/repeatingImageTransition";

// Dev-only console logging — open DevTools and scroll to #seasons to watch the
// phases (globe → approach → inside → unwrap → grid).
const DEBUG = false;
function logDebug(...args: unknown[]) {
  if (DEBUG) console.log("[SeasonsGlobe]", ...args);
}

// ── Layout ──────────────────────────────────────────────────────────────────
// Fourteen rows of latitude, each holding as many marks as its circumference
// allows — 3 at the polar rows up to 28 at the equator, in proportion to
// sin(latitude) — so the marks are spaced the same everywhere on the shell.
// The old 18-per-row grid packed eighteen marks into a ring 0.67 units
// across at each pole, a knot of overlapping marks that did not show while
// the camera looked at the equator and sits in plain view now that it looks
// down onto the pole. The counts sum to 252, which the archived flat grid
// still needs (7 columns of 36).
const SROWS = 14; // sphere rows (latitude)
const ROW_COUNTS = [3, 9, 15, 20, 24, 27, 28, 28, 27, 24, 20, 15, 9, 3];
const TILE_COUNT = ROW_COUNTS.reduce((a, b) => a + b, 0); // 252
/** Spacing between marks along a row and between rows — the same. */
const SPHERE_PITCH_FRAC = Math.PI / SROWS;
// Flat-grid columns. TILE_COUNT (252 = 2²·3²·7) must divide by this, so 5 is
// not available here — 7 is the next step down from 9 and gives longer columns
// (36 rows each). What the viewer actually counts on screen is VISIBLE_COLS
// below, which is what carries the "5 columns" framing; the extra column either
// side lives under the edge blur so the columns have something to dissolve into.
const GRID_COLS = 7;
const GRID_ROWS = TILE_COUNT / GRID_COLS; // 36
const SPHERE_R = 6; // globe radius
// Tile size. Was 0.82 — an inset inside a white backing card; that card is gone,
// so the mark fills the tile and keeps the globe's original footprint.
const PHOTO_INSET = 1;
// ── Tiles standing off the shell ──
//
// In the client's reference (Screen Recording 2026-08-27 060825, a clean
// 1050x612 screen capture) the marks are NOT a flush mosaic. They are cards
// floating at slightly different radii: at the silhouette several project
// past the outline as thin slivers, and their sizes vary a lot. The shell
// reads as a cloud of cards held in a sphere rather than as a skin painted
// on one.
//
// Kept small on purpose: past ~0.12 the silhouette stops reading as a sphere
// and starts reading as a swarm.
const TILE_STANDOFF = 0.11; // extra radius, as a fraction of SPHERE_R
const TILE_SIZE_MIN = 0.74; // per-tile size spread, x sphereTile
const TILE_SIZE_MAX = 1.42;

// ── Camera / timeline ───────────────────────────────────────────────────────
// ── The rest camera ──
//
// The view the client pointed at is the editor shot of Recording 2026-09-05
// 190603 (f33–f47, the mosaic globe in its 1200x800 canvas), and their words
// for it: "how the moon views the earth from a certain top angle". So the
// camera is ABOVE the globe, looking down onto it — the top of the globe
// reads as a cap, the rows of marks bow ∪ around it — through a normal lens
// (the mosaic's tiles keep most of their width out to ~70% of the radius
// before the rim foreshortens them, which a close, wide lens would not
// allow; that is a camera several radii out).
//
// The angle is the one both recordings measure. Fitting a level camera to
// the 27 Aug card globe gave "north pole 10° away from the viewer"; the rings
// on the far wall of the 5 Sept globe sit 0.19R above centre, which is 11°.
// Those are the same fact read two ways — a sphere pitched 10° away looks
// exactly like an upright sphere seen from 10° above — and the client's
// description settles which: the camera is up, the globe is upright. (An
// earlier pass had both at once, the camera raised 11° AND the axis pitched
// 10° away, which cancelled to a level view and read as no angle at all.)
//
// Two things the client asked for on top of the angle: the WHOLE globe in
// frame, never clipped top or bottom, and everything from before (tilt,
// spin, hover, floor shadow) still visible under it. Hence the fill below
// and the strip it leaves.
const FOV_GLOBE = 45; // the globe from outside — a normal lens
/** The camera's elevation above the globe's centre, as seen from it. */
// Steep — the frame the client sent (the small globe at the top of the same
// recording) shows the pole well inside the disc, about 0.4R from its centre
// toward the top: the view is down onto the globe from above, not across it.
// A pole at 0.4R from centre means the camera sits acos(0.4) ≈ 66° above the
// equator; 62° lands it at 0.47R and keeps a little more of the side in view.
const CAM_ELEV = 1.08; // rad, ≈ 62°
const FOV_INSIDE = 62; // wide, curved view from inside
const FOV_GRID = 45; // frames the flat grid
/**
 * How much of the viewport's SHORTER side the globe's radius fills at rest —
 * 0.8 spans 80% of the height on a landscape screen and 80% of the width on
 * a phone, centred, so there is a clear 10% above and below it: room for the
 * top of the globe, and for the floor shadow and hint line under it. The
 * camera distance is derived from this per viewport (see camRest in the
 * Scene) rather than fixed: a fixed distance framed the globe by height
 * alone and let it run off both sides of a portrait screen. At 45° this
 * puts the camera about 3.4 radii out on a landscape screen.
 */
const GLOBE_FILL = 0.8;
/**
 * Radius of the silhouette as it actually measures on screen. Less than the
 * shell plus its standoff (6.66) plus half a card: the cards at the rim are
 * seen edge-on, so the outline is set by their centres, not their corners.
 * Derived from that geometry, framing landed at 73% instead of 80%; 6.4 is
 * what measures 80%.
 */
const GLOBE_OUTER = 6.4;
const CAM_CENTER = 0.05; // ~sphere centre (not exactly 0 so lookAt is stable)
const CAM_GRID = 7;
// ── The opening, measured off the client's reference ──
//
// Recording 2026-09-05 190603 between the 2s and 3s marks, which the client
// asked for played BACKWARDS as the click: forwards it is the camera pulling
// out of the globe (f75–f93), backwards it is the camera going in. Stepped at
// 30fps against the green, with the silhouette measured wherever it was in
// frame:
//
//   f74        holding just inside the shell, ~0.85R from the centre
//   f75–f77    the near marks appear at the frame edges — the camera crosses
//              the shell, ~0.1R per frame
//   f78–f88    the globe shrinks toward the frame, ~0.05R per frame
//   f89–f93    silhouette 1.14x → 1.07x → 1.03x → 1.03x → 1.0 of rest: the
//              last 15% eases out
//   f93        at rest, 1.8R out
//
// Progress against time: 0.16 at t=0.16, 0.84 at t=0.79, 0.96 at t=0.89 —
// very nearly linear, with a soft end. Reversed for the click: a soft start,
// then the camera goes in at a steady ~1.5R/s and arrives inside at speed,
// 0.63s in all, lens unchanged throughout. The marks nearest the camera
// stream past the edges as it crosses the shell; inside, the far wall is the
// whole view, turning with the spin, and the marks close to the lens sweep
// past the corners far faster than the far ones drift — the parallax the
// client describes as the images "moving freely". It stays there: the shell
// keeps spinning and a mark on it can be clicked. The field that used to
// open here is left in the code but not reached (FIELD_OPENS).
const ENTRY_DUR = 0.63; // rest → inside
/** Where the camera stops: inside the shell, as a fraction of the radius. */
const CAM_HOLD = SPHERE_R * 0.85;
/** The entry's curve: a power of 1.3 — near linear, soft at the start, which is the measured exit's soft end played backwards. */
const easeInSoft = (t: number) => Math.pow(t, 1.3);
/** The shell stays intact inside; the drifting field is not opened. */
const FIELD_OPENS = false;
// ── The marks parting around the camera ──
//
// The reference tool (its own description, on screen in the editor shot)
// pushes tiles away from the cursor — "a raycasting engine detects your
// hover position and applies a repulsion force" — and the cursor is on the
// globe when it is clicked. That is why its centre is already clear as the
// camera goes in, and why the tiles stream past the EDGES rather than
// hitting the lens: they part around the line the camera travels down. It
// is also what "the top images expanding, becoming a different part, leaving
// the globe ever so slightly" describes. Ours does the same along the
// camera's line of sight: a mark within TUNNEL_R of it, and within
// TUNNEL_REACH ahead of the camera, is pushed out sideways to the tunnel's
// edge, more the nearer the camera is. Without it a mark that happened to
// sit on the path filled the whole frame for a beat.
const TUNNEL_R = 1.1; // world units, the clear radius round the line of sight
const TUNNEL_REACH = 3.5; // how far ahead of the camera marks start to part
const UNWRAP_DUR = 2.4; // seconds, camera pull-back on the image click
const UNWRAP_RISE = 0.9; // per-tile flatten duration
const STAGGER_ANG = 0.28; // per-tile delay by sphere-angle from the click
// ── The idle, measured off the client's reference ──
//
// Screen Recording 2026-08-27 060825 (a clean 1050x612 capture of the card
// globe, 30fps, 5s). Two teal cards were tracked through it frame by frame
// and a tilted rotating sphere fitted to their paths (rms 1.6px):
//
//   spin   0.377 rad/s — 21.6°/s, one turn every 16.7s, constant; the near
//          side travels left → right and rises to the right along the bands.
//   roll   ~14° in the picture plane, north pole to the LEFT.
//   pitch  ~10° between the axis and the picture plane (the fit at the
//          opposite sign is 3.5x worse). With the camera modelled level that
//          reads as the pole leaning away; it is carried as the CAMERA's
//          elevation instead — see CAM_ELEV — because that is what the
//          client sees in it, and the two are the same picture.
//   float  the whole globe drifts ~2% of its height up and back over the
//          clip — a slow hover, not a bob you would notice on its own.
//   shadow a thin grey streak on the floor just under the globe — see
//          SHADOW_* below and the element that draws it.
//
// The old 0.16 was 2.4x too slow; that is most of what "the way the globe is
// moving" was about.
const SPIN_SPEED = 0.38; // rad/s globe rotation
/** Hover: vertical drift as a fraction of the radius, and its period. */
const FLOAT_AMP = 0.012;
const FLOAT_PERIOD = 7; // seconds, up and back
// Axial tilt, so the globe leans like the reference rather than sitting dead
// upright — a roll in the picture plane plus a pitch of the axis away from the
// viewer. The spin happens INSIDE this tilt (see the premultiply in the frame
// loop), so the globe rotates about its own leaned axis the way a planet
// does, instead of wobbling around the world's vertical.
//
// SIGN: positive rolls the north pole to the LEFT, which lays the visible rows
// of tiles bottom-left → top-right. That is the brief, and it is worth being
// explicit about why, because the axis and the bands lean OPPOSITE ways and
// "the tilt" was read as the axis first time round: leaning the pole left tips
// the equator's right-hand side up, so every latitude band rises to the right.
// The bands are what a viewer actually sees — the axis is invisible — so the
// bands are what the direction is specified against.
//
// MAGNITUDES: the reference's card edges near the centre of the disc sit at
// +12° (an edge-orientation histogram); ours measured +10.7° at 0.22, so 0.24
// is what lands on it. No pitch: the axis stands upright in the world and the
// 10° the fit found lives on the camera (CAM_ELEV), which looks down onto the
// globe. Pitching the axis away as well cancels the camera out — that was the
// "no angle" the client complained about.
const TILT_ROLL = 0.24; // rad, ≈ +13.8° lean in the picture plane
const TILT_PITCH = 0; // rad — the axis is upright; the lean is the camera's
// ── The floor shadow ──
//
// In the reference the globe sits just above a floor and casts a shadow on
// it, and because the camera is at the globe's height and far away, the
// floor is seen almost edge-on: the shadow is a thin, wide, faint streak, not
// a disc. Measured on the clip against a 470px globe: it starts ~8px below the
// lowest card, is ~12px tall and ~510px wide, sits ~38px to the RIGHT of the
// globe's centre (the light is high on the left), and darkens the floor by
// ~10% at its core, feathering out to nothing. All as fractions of the
// globe's on-screen diameter here; drawn in screen space (a DOM element under
// the canvas) because our camera is much closer than the reference's, and a
// real floor at this distance would read as a fat ellipse instead.
const SHADOW_GAP = 0.03; // below the lowest mark, which sits a little past the fitted outline
const SHADOW_HEIGHT = 0.028;
const SHADOW_WIDTH = 1.1;
const SHADOW_OFFSET_X = 0.08; // to the right
// Far stronger than the reference's 10%: that is black on a light grey floor,
// while ours sits on the dark red of the page background, where a 16% veil
// measured as a 4-point drop in luminance and could not be seen at all.
const SHADOW_ALPHA = 0.55; // at the core; the gradient feathers it out
const SCROLL_SPEED = 0.55; // grid column scroll, world units / s
const GRID_GAP = 0.16; // gap as a fraction of the grid pitch
const VISIBLE_COLS = 5; // how many columns fill the width (was 6.4 → ~7 on screen)
const columnDir = (col: number) => (col % 2 === 0 ? 1 : -1);

// ── The field (the "inside" view) ───────────────────────────────────────────
// Once the camera reaches the centre the sphere shell opens out into a drifting
// cloud of marks that flows past you — the instanced-plane field from the
// reference sketch, rebuilt on the tiles this section already owns.
//
// The reference does the whole thing in a vertex shader over 400 instances,
// wrapping each plane modularly so the field is endless. Here the same wrap
// runs in JS over the 252 tile groups the timeline already drives per frame,
// because those exact groups are what the unwrap later flattens into the grid.
// A separate instanced field would have to hand its planes over to them mid
// animation; blending the tiles' own target position from sphere → field costs
// nothing extra and keeps one object under the whole timeline.
// The camera sits at ~z=0 looking down -z, so anything past FIELD_Z_NEAR is
// behind it and costs a tile for nothing — kept just far enough forward that
// marks still sweep past the lens before wrapping round to the back.
const FIELD_Z_NEAR = 2; // where tiles wrap out
const FIELD_Z_FAR = -34; // far plane — where they wrap back in
const FIELD_REF_D = 12; // depth the spread is measured at
const FIELD_SPREAD = 2.4; // how many view-widths/heights of scatter
const FIELD_FLOW = 2.4; // constant forward drift, world units / s
// Tile scale in the field. Sized against the view rather than against the
// sphere tile (0.84): the reference's planes are roughly a fifth of the frame
// height, and at the sphere's scale 252 marks spread through this much space
// read as confetti rather than as a field you are standing inside.
const FIELD_TILE = 2.8;
const FIELD_EMERGE = 7; // depth band a wrapped tile grows back in over
const STAGGER_FIELD = 0.055; // unwrap delay per world unit from the clicked tile

// Drag. Pointer only — the wheel is deliberately left alone so the page still
// scrolls past this section under the shared Locomotive provider.
const DRAG_DAMPING = 0.1;
const DRAG_THRESHOLD = 6; // px of travel before a press counts as a drag
const DRAG_SENSITIVITY = 0.035; // px → world units

/**
 * ARCHIVED, not deleted: the third view — the unwrap into the scrolling flat
 * grid — is parked behind this flag. The field (the drifting cloud you stand
 * inside) turned out to be the stronger stage, so clicking a mark there now
 * expands it to the centre directly, and the grid never comes up. Everything
 * the grid needs (the unwrap timeline, the column scroll, the edge blurs, the
 * freeze) is kept intact below: flip this to false and the old
 * click-to-unwrap flow is back. The reduced-motion path still uses the grid —
 * it jumps straight to a calm, flat layout instead of the endlessly-flowing
 * field, which is exactly what that preference is asking for.
 */
const GRID_ARCHIVED = true;

type Phase = "globe" | "approach" | "inside" | "unwrap" | "grid";

/** Tile index → where that tile is on screen right now, in viewport px. */
type TileRectFn = (tileIndex: number) => TrailRect | null;

/**
 * Where the pointer has dragged the field to. Targets only — the Scene keeps
 * the damped values it actually renders in a ref of its own, because the React
 * Compiler (rightly) rejects reaching into a ref that arrived as a prop and
 * mutating the object inside it.
 */
interface DragState {
  xTarget: number;
  yTarget: number;
}

/**
 * The Zuhayr "Z" rendered as a city / culture skin — the brand "seasons".
 * Transparent PNGs rendered with no backing plane, so each mark sits directly
 * on the scene. Titles and dates feed the expand-to-centre panel (like the
 * Careers page). Add more here as they're produced.
 * ⚠️ Titles/dates are placeholders — tweak to taste.
 */
interface ClubImage {
  src: string;
  title: string;
  date: string;
}
const IMAGES: ClubImage[] = [
  { src: "/AI-7.png", title: "Tokyo", date: "Cherry Blossom" },
  { src: "/AI-15.png", title: "Hong Kong", date: "Bauhinia" },
  { src: "/AI-12.png", title: "Lunar", date: "Year of the Dragon" },
  { src: "/AI-14.png", title: "Singapore", date: "Marina Bay" },
];

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Centered wrap: fold v into [-period/2, period/2) so a column loops forever. */
const wrap = (v: number, period: number) =>
  THREE.MathUtils.euclideanModulo(v + period / 2, period) - period / 2;

/**
 * Deterministic 0–1 from an integer — the field's scatter instead of
 * `Math.random`. Pure, so it satisfies the React Compiler's purity rule (which
 * rejects Math.random during render), and stable, so the cloud comes back
 * identical across a remount rather than reshuffling itself.
 */
const hash01 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Scratch objects reused every frame (avoid per-frame allocation).
const _spin = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);
// The tilt is constant, so it is built once, not per frame.
const _tilt = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(TILT_PITCH, 0, TILT_ROLL),
);
const _sphereQuat = new THREE.Quaternion();
const _spherePos = new THREE.Vector3();
const _gridPos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _IDENTITY_QUAT = new THREE.Quaternion();
const _fieldPos = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _lat = new THREE.Vector3();
const _xAxis = new THREE.Vector3(1, 0, 0);
const _clickFieldPos = new THREE.Vector3();
const _fromPos = new THREE.Vector3();
const _fromQuat = new THREE.Quaternion();
const _projCentre = new THREE.Vector3();
const _projEdge = new THREE.Vector3();

interface TileData {
  gridCol: number;
  gridRow: number;
  dir: number;
  sphereDir: THREE.Vector3;
  sphereBaseQuat: THREE.Quaternion;
  texIndex: number;
  /** Field scatter, stored NORMALISED (x,y in ±0.5; z in 0–1) so a resize
   *  rescales the cloud instead of reshuffling it. */
  fnx: number;
  fny: number;
  fnz: number;
  /** Per-tile flow multiplier — the reference's `aMeshSpeed`. */
  fspeed: number;
  /** Radius multiplier on the shell — 1 sits flush, >1 floats off it. */
  standoff: number;
  /** Size multiplier on the shell, so the cards are not all one size. */
  sizeMul: number;
}

interface FieldSpan {
  x: number;
  y: number;
  z: number;
  zCenter: number;
  tile: number;
}

/**
 * Where a tile sits in the field right now.
 *
 * Each axis is wrapped modularly, which is what makes the cloud endless: a tile
 * that flows past the camera reappears at the far plane rather than running out
 * of field. `wrap` folds into ±span/2, so z carries its centre separately.
 */
const fieldPosOf = (
  tile: TileData,
  flow: number,
  dragX: number,
  dragY: number,
  span: FieldSpan,
  out: THREE.Vector3,
) => {
  out.set(
    wrap(tile.fnx * span.x - dragX, span.x),
    wrap(tile.fny * span.y - dragY, span.y),
    wrap(
      (tile.fnz - 0.5) * span.z + flow * tile.fspeed - span.zCenter,
      span.z,
    ) + span.zCenter,
  );
  return out;
};

// ── Scene — loads textures, lays out tiles, drives the whole timeline ────────
function Scene({
  instant,
  expandRequest,
  unwrapRequest,
  clickedTile,
  phaseRef,
  onImageOpen,
  drag,
  didDrag,
  onTileRect,
  freezeGrid,
}: {
  instant: boolean;
  expandRequest: RefObject<boolean>; // first click → fly INTO the globe
  unwrapRequest: RefObject<boolean>; // click inside → unwrap to the grid
  clickedTile: RefObject<number>;
  phaseRef: RefObject<Phase>; // written each frame; the section polls it for UI
  onImageOpen: (texIndex: number) => void; // grid click → expand to centre
  drag: RefObject<DragState>; // pointer drag through the field
  didDrag: RefObject<boolean>; // true if the press that just ended was a drag
  /** Publishes the projector up to the section (see TileRectFn). */
  onTileRect: (fn: TileRectFn | null) => void;
  /** Holds the grid still while an image is open and its transition runs. */
  freezeGrid: RefObject<boolean>;
}) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const glCanvas = useThree((s) => s.gl.domElement);
  const textures = useLoader(
    THREE.TextureLoader,
    IMAGES.map((im) => im.src),
  );
  // Horizontally-flipped clones for the tiles' BACK faces — seen from inside
  // the globe, a plain double-sided texture reads mirrored (a backwards Z), so
  // the back gets a pre-flipped copy that cancels the mirror.
  const flippedTextures = useMemo(
    () =>
      textures.map((t) => {
        const c = t.clone();
        c.colorSpace = THREE.SRGBColorSpace;
        c.anisotropy = 8;
        c.wrapS = THREE.RepeatWrapping;
        c.repeat.x = -1;
        c.offset.x = 1;
        c.needsUpdate = true;
        return c;
      }),
    [textures],
  );
  const groups = useRef<(THREE.Group | null)[]>([]);
  const start = useRef(-1);
  const scroll = useRef(0);
  const spinAngle = useRef(0); // accumulated (dt-based) so it survives frameloop pauses
  const phase = useRef("");
  const unwrapStart = useRef(-1);
  const gridReady = useRef(false);
  const fieldFlow = useRef(0);
  // Damped follow of the drag targets the section writes. Owned here so the
  // frame loop only ever READS the incoming ref.
  const dragCurrent = useRef({ x: 0, y: 0 });

  const tiles = useMemo<TileData[]>(() => {
    return Array.from({ length: TILE_COUNT }, (_, i) => {
      // Which row this index falls in, and where along it.
      let srow = 0, first = 0;
      while (i >= first + ROW_COUNTS[srow]) first += ROW_COUNTS[srow++];
      const scol = i - first;
      const phi = ((srow + 0.5) / SROWS) * Math.PI;
      // Alternate rows start half a step round, so marks sit between the
      // ones above and below rather than lining up into columns.
      const theta =
        ((scol + (srow % 2) * 0.5) / ROW_COUNTS[srow]) * Math.PI * 2;
      const sphereDir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );
      // Orientation from an EXPLICIT basis rather than setFromUnitVectors.
      // setFromUnitVectors returns the shortest-arc rotation from +Z to the
      // tile's direction, and that rotation carries an arbitrary roll: it only
      // happens to keep the mark upright on the equator (where its axis is the
      // world Y), and twists further the closer a tile sits to a pole. That
      // twist was the slant. Building the basis by hand pins the tile's local
      // +Y to its meridian (toward the north pole) and +Z to the outward
      // normal, so every mark stands upright on the sphere.
      const zAxis = sphereDir.clone();
      const worldUp = new THREE.Vector3(0, 1, 0);
      // Exactly at a pole the meridian is undefined (worldUp ∥ zAxis) and the
      // cross product collapses — fall back to a reference that never does.
      const ref =
        Math.abs(zAxis.dot(worldUp)) > 0.9995
          ? new THREE.Vector3(0, 0, 1)
          : worldUp;
      const xAxis = new THREE.Vector3().crossVectors(ref, zAxis).normalize();
      const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
      const sphereBaseQuat = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis),
      );
      return {
        gridCol: i % GRID_COLS,
        gridRow: Math.floor(i / GRID_COLS),
        dir: columnDir(i % GRID_COLS),
        sphereDir,
        sphereBaseQuat,
        texIndex: i % textures.length,
        // Derived from the index, not drawn fresh: the scatter must not
        // reshuffle on a resize (or on every frame), so it lives on the tile
        // and the span scales it.
        fnx: hash01(i * 4 + 1) - 0.5,
        fny: hash01(i * 4 + 2) - 0.5,
        fnz: hash01(i * 4 + 3),
        fspeed: hash01(i * 4 + 4) * 0.5 + 0.5,
        // A different stride from the field scatter above, so a tile that sits
        // far out is not also the one that flies fastest — i*4+n and i*13+n
        // do not line up.
        standoff: 1 + hash01(i * 13 + 7) * TILE_STANDOFF,
        sizeMul:
          TILE_SIZE_MIN +
          hash01(i * 13 + 11) * (TILE_SIZE_MAX - TILE_SIZE_MIN),
      };
    });
  }, [textures.length]);

  const field = useMemo<FieldSpan>(() => {
    const aspect = size.width / size.height;
    // The view at a mid depth, then scattered over several times that, so the
    // cloud runs well past the frame edges and tiles rush in from off-screen
    // rather than appearing inside it.
    const viewH = 2 * Math.tan((FOV_INSIDE * Math.PI) / 360) * FIELD_REF_D;
    return {
      x: viewH * aspect * FIELD_SPREAD,
      y: viewH * FIELD_SPREAD,
      z: FIELD_Z_NEAR - FIELD_Z_FAR,
      zCenter: (FIELD_Z_NEAR + FIELD_Z_FAR) / 2,
      tile: FIELD_TILE,
    };
  }, [size.width, size.height]);

  /**
   * The rest distance: how far back the camera sits for the globe's radius to
   * fill GLOBE_FILL of the viewport's shorter side. A sphere of radius R at
   * distance d subtends asin(R/d), and its projected radius is the tangent of
   * that, so the distance follows from the half-extent we want it to cover.
   */
  const camRest = useMemo(() => {
    const aspect = size.width / size.height;
    const halfExtent =
      Math.tan((FOV_GLOBE * Math.PI) / 360) * Math.min(aspect, 1) * GLOBE_FILL;
    return GLOBE_OUTER / Math.sin(Math.atan(halfExtent));
  }, [size.width, size.height]);

  const grid = useMemo(() => {
    const aspect = size.width / size.height;
    const halfH = Math.tan((FOV_GRID * Math.PI) / 360) * CAM_GRID;
    const viewW = 2 * halfH * aspect;
    const pitch = viewW / VISIBLE_COLS;
    const tileWorld = pitch * (1 - GRID_GAP);
    const period = GRID_ROWS * pitch;
    const baseX = (col: number) => (col - (GRID_COLS - 1) / 2) * pitch;
    const baseY = (row: number) => (row - (GRID_ROWS - 1) / 2) * pitch;
    const sphereTile = SPHERE_R * SPHERE_PITCH_FRAC * 0.62;
    return { pitch, tileWorld, period, baseX, baseY, sphereTile };
  }, [size.width, size.height]);

  /**
   * Where a tile is on screen at this instant.
   *
   * The grid keeps scrolling while an image is open — deliberately, so the
   * lightbox sits over a live grid — so the tile that was clicked is not where
   * it was when it was clicked. The trail asks for this at play time rather
   * than being handed a box up front, which is what keeps its clones anchored
   * to the tile on the way in AND on the way back out.
   *
   * The tile is a square in world units and the camera is perspective, so the
   * pixels-per-world-unit factor is identical on both axes — measuring the
   * half-width by projecting one edge point gives the height for free.
   */
  const projectTile = useCallback<TileRectFn>(
    (i: number) => {
      const g = groups.current[i];
      if (!g || !glCanvas) return null;
      const canvas = glCanvas.getBoundingClientRect();
      if (!canvas.width || !canvas.height) return null;

      _projCentre.setFromMatrixPosition(g.matrixWorld);
      _projEdge.copy(_projCentre);
      _projEdge.x += (g.scale.x * PHOTO_INSET) / 2;

      _projCentre.project(camera);
      _projEdge.project(camera);
      // Behind the camera — the projection wraps and the numbers are nonsense.
      if (_projCentre.z > 1) return null;

      const cx = canvas.left + (_projCentre.x * 0.5 + 0.5) * canvas.width;
      const cy = canvas.top + (-_projCentre.y * 0.5 + 0.5) * canvas.height;
      const ex = canvas.left + (_projEdge.x * 0.5 + 0.5) * canvas.width;
      const half = Math.abs(ex - cx);
      if (!half) return null;

      return {
        left: cx - half,
        top: cy - half,
        width: half * 2,
        height: half * 2,
      };
    },
    [camera, glCanvas],
  );

  // Hand it to the section, which owns the ref the trail reads. The write has
  // to happen there: the React Compiler (rightly) refuses to let this component
  // reach into a ref it was handed as a prop and mutate it.
  useEffect(() => {
    onTileRect(projectTile);
    return () => onTileRect(null);
  }, [onTileRect, projectTile]);

  useFrame((state, rawDt) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const dt = Math.min(rawDt, 1 / 30);
    const clock = state.clock.elapsedTime;

    // The entry only begins once the globe has been clicked (or reduced
    // motion jumps straight in). Until then the globe just sits and spins.
    const running = expandRequest.current || instant;
    if (running && start.current < 0) {
      start.current = clock;
      logDebug(
        `entry click → inside (${TILE_COUNT} tiles, ${textures.length} textures)`,
      );
    }
    const elapsed = !running ? 0 : clock - start.current;

    // "How far in are we" — the dolly's 0→1 from the click (see "The
    // opening"). Everything downstream (the unwrap gate, the phase) means
    // this by `approach`.
    const approach = instant
      ? 1
      : running
        ? easeInSoft(THREE.MathUtils.clamp(elapsed / ENTRY_DUR, 0, 1))
        : 0;
    // The camera's distance from the globe's centre, along its (elevated)
    // line of sight: the rest framing for this viewport, dollying in to
    // CAM_HOLD. The lens does not change.
    const entry = instant
      ? { z: CAM_CENTER, fov: FOV_INSIDE }
      : { z: THREE.MathUtils.lerp(camRest, CAM_HOLD, approach), fov: FOV_GLOBE };

    if (
      (instant || (unwrapRequest.current && approach > 0.9)) &&
      unwrapStart.current < 0
    ) {
      unwrapStart.current = elapsed;
      if (!instant)
        logDebug(`image click → unwrapping to grid (from tile ${clickedTile.current})`);
    }
    const unwrapElapsed =
      unwrapStart.current < 0 ? 0 : elapsed - unwrapStart.current;
    const unwrap = instant
      ? 1
      : easeInOut(THREE.MathUtils.clamp(unwrapElapsed / UNWRAP_DUR, 0, 1));

    // Spin accumulates off dt (not the wall clock) so pausing the canvas while
    // the section is scrolled away doesn't make it jump on return. Eases to a
    // stop as the globe unwraps.
    spinAngle.current += dt * SPIN_SPEED * (1 - unwrap);
    // Spin about the globe's own Y first, THEN lean the whole thing: the
    // premultiplied tilt turns the spin axis itself, which is what reads as a
    // tilted planet. The other order (tilt inside spin) would swing the lean
    // around the vertical instead — a wobble, not a tilt. Position and
    // orientation both derive from _spin below, so the tiles lean with it.
    _spin.setFromAxisAngle(_yAxis, spinAngle.current).premultiply(_tilt);

    // Two timelines can own the camera, and only one at a time: the unwrap
    // (once an image is opening) and, before it, the entry.
    const camZ =
      unwrapStart.current < 0
        ? entry.z
        : THREE.MathUtils.lerp(CAM_CENTER, CAM_GRID, unwrap);
    const fov =
      unwrapStart.current < 0
        ? entry.fov
        : THREE.MathUtils.lerp(FOV_INSIDE, FOV_GRID, unwrap);
    if (instant || unwrapStart.current >= 0) {
      // The archived grid path: straight down -z from the centre.
      camera.position.set(0, 0, camZ);
      camera.lookAt(0, 0, 0);
    } else {
      // camZ out from the globe's centre along a line CAM_ELEV above the
      // equator, looking straight at the centre — at rest, through the dolly,
      // and inside: the camera only ever moves along this line.
      camera.position.set(
        0,
        camZ * Math.sin(CAM_ELEV),
        camZ * Math.cos(CAM_ELEV),
      );
      camera.lookAt(0, 0, 0);
    }
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // Grid columns scroll once the unwrap is essentially done — but they HOLD
    // for the whole time an image is open.
    //
    // This used to keep running, on the grounds that a frozen grid made the
    // section look like it had hung. That was before the open/close transition
    // existed: the trail is anchored to the tile that was clicked, and a grid
    // still scrolling underneath meant the clones were chasing a target that
    // had moved — several hundred pixels, if the image sat open for a few
    // seconds. Holding it is also what the lightbox now sits over: a blurred
    // backdrop, through which the motion was barely legible anyway.
    const scrollGate = THREE.MathUtils.clamp((unwrap - 0.7) / 0.3, 0, 1);
    if (!freezeGrid.current) scroll.current += dt * SCROLL_SPEED * scrollGate;
    if (unwrap >= 1) gridReady.current = true;

    // How far the sphere has opened out into the field. Not at all, now: the
    // opening ends inside the intact shell (see "The opening"). Reduced
    // motion never builds a field either — it goes straight to the grid.
    const fieldBlend = FIELD_OPENS && running && !instant ? 1 : 0;

    // The slow hover from the reference. Wall-clock, like the spin, and damped
    // out by the unwrap so the flight to the grid starts from a still shell.
    const hover =
      Math.sin((clock * 2 * Math.PI) / FLOAT_PERIOD) *
      FLOAT_AMP *
      SPHERE_R *
      (1 - unwrap);

    // The camera's line of sight, for the marks to part around (see
    // TUNNEL_R). Only while the entry is running and the shell is still a
    // shell — never during the unwrap, which flies the marks to the grid.
    const tunnel = running && !instant && unwrapStart.current < 0;
    if (tunnel) {
      _camPos.copy(camera.position);
      _axis.copy(_camPos).negate().normalize();
    }

    // The cloud flows forward, and damps toward the drag the pointer asked for.
    // Both stop once the unwrap starts, for the same reason as above.
    fieldFlow.current += dt * FIELD_FLOW * (1 - unwrap);
    dragCurrent.current.x +=
      (drag.current.xTarget - dragCurrent.current.x) * DRAG_DAMPING;
    dragCurrent.current.y +=
      (drag.current.yTarget - dragCurrent.current.y) * DRAG_DAMPING;
    const dragX = dragCurrent.current.x;
    const dragY = dragCurrent.current.y;

    const clickedTileData = tiles[clickedTile.current];
    const clickDir = clickedTileData?.sphereDir;
    // Stagger the unwrap outward from whatever was clicked. On the sphere that
    // is an angle between directions; in the field the tiles no longer sit on
    // a shell, so the same angle would be unrelated to what the viewer sees —
    // there it is the plain distance from the clicked tile's field position.
    if (clickedTileData) {
      fieldPosOf(
        clickedTileData,
        fieldFlow.current,
        dragX,
        dragY,
        field,
        _clickFieldPos,
      );
    }

    for (let i = 0; i < tiles.length; i++) {
      const g = groups.current[i];
      if (!g) continue;
      const tile = tiles[i];

      _spherePos
        .copy(tile.sphereDir)
        .applyQuaternion(_spin)
        .multiplyScalar(SPHERE_R * tile.standoff);
      _spherePos.y += hover;

      if (tunnel) {
        _rel.subVectors(_spherePos, _camPos);
        const along = _rel.dot(_axis);
        if (along > 0 && along < TUNNEL_REACH) {
          _lat.copy(_rel).addScaledVector(_axis, -along);
          const lat = _lat.length();
          if (lat < TUNNEL_R) {
            // Full push at the lens, none TUNNEL_REACH ahead — the parting
            // runs just ahead of the camera as it advances.
            const push = (TUNNEL_R - lat) * (1 - along / TUNNEL_REACH);
            if (lat > 1e-3) _spherePos.addScaledVector(_lat, push / lat);
            else _spherePos.addScaledVector(_xAxis, push);
          }
        }
      }
      _sphereQuat.multiplyQuaternions(_spin, tile.sphereBaseQuat);

      fieldPosOf(tile, fieldFlow.current, dragX, dragY, field, _fieldPos);

      // Where this tile is coming FROM: the sphere shell, opened out toward its
      // place in the field. In the field it faces the camera square on, which
      // is also the grid's orientation — so the mark turns to face you as the
      // globe opens and never turns again.
      _fromPos.lerpVectors(_spherePos, _fieldPos, fieldBlend);
      _fromQuat.copy(_sphereQuat).slerp(_IDENTITY_QUAT, fieldBlend);

      // Any unwrap that can actually happen (gated on approach > 0.9) is one
      // where the tiles are already heading for the field, so the stagger keys
      // off field distance. The sphere angle is only the fallback for the
      // reduced-motion path, which never builds a field at all.
      const delay =
        fieldBlend > 0
          ? _clickFieldPos.distanceTo(_fieldPos) * STAGGER_FIELD
          : (clickDir ? clickDir.angleTo(tile.sphereDir) : 0) * STAGGER_ANG;
      const m =
        unwrapStart.current < 0
          ? 0
          : easeInOut(
              THREE.MathUtils.clamp(
                (unwrapElapsed - delay) / UNWRAP_RISE,
                0,
                1,
              ),
            );

      const y = wrap(
        grid.baseY(tile.gridRow) + tile.dir * scroll.current,
        grid.period,
      );
      _gridPos.set(grid.baseX(tile.gridCol), y, 0);

      g.position.lerpVectors(_fromPos, _gridPos, m);
      g.quaternion.copy(_fromQuat).slerp(_IDENTITY_QUAT, m);

      // A tile that has just wrapped round to the far plane grows in over
      // FIELD_EMERGE rather than popping into existence. Scale rather than
      // opacity on purpose: these marks are cut-outs drawn with alphaTest, so
      // fading their opacity erodes the glyph (the test bites at a higher and
      // higher texture alpha) instead of dimming it.
      const emerge = THREE.MathUtils.clamp(
        (_fieldPos.z - FIELD_Z_FAR) / FIELD_EMERGE,
        0,
        1,
      );
      const base = THREE.MathUtils.lerp(
        grid.sphereTile * tile.sizeMul,
        field.tile * emerge,
        fieldBlend,
      );
      const s = THREE.MathUtils.lerp(base, grid.tileWorld, m);
      _scale.set(s, s, s);
      g.scale.copy(_scale);
    }

    // Publish the phase for the section's UI (hints, side-blur, cursor).
    const p: Phase =
      !expandRequest.current && !instant
        ? "globe"
        : unwrapStart.current >= 0
          ? unwrap < 1
            ? "unwrap"
            : "grid"
          : approach < 1
            ? "approach"
            : "inside";
    phaseRef.current = p;

    if (DEBUG && p !== phase.current) {
      phase.current = p;
      logDebug(
        `phase → ${p} | cam.z=${camZ.toFixed(2)} fov=${fov.toFixed(0)} approach=${approach.toFixed(2)} unwrap=${unwrap.toFixed(2)}`,
      );
    }
  });

  const onTileClick = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // The press that just ended moved — it was a drag through the field, not a
    // click on a mark. Without this, every drag that happened to finish over a
    // tile would also open it.
    if (didDrag.current) return;
    // Grid is up (reduced-motion / un-archived flow) → clicking a photo
    // expands it to the centre.
    if (instant || gridReady.current) {
      // Remember WHICH tile, not where it was: the trail projects this tile's
      // live position whenever it needs it, and the grid never stops scrolling.
      clickedTile.current = i;
      onImageOpen(tiles[i].texIndex);
      return;
    }
    // First click → fly into the globe.
    if (!expandRequest.current) {
      expandRequest.current = true;
      return;
    }
    if (GRID_ARCHIVED) {
      // The field is the destination now: clicking a mark IN the field expands
      // it to the centre with the same trail transition the grid used. Gated
      // on the phase so a click during the fly-in doesn't open an image while
      // the camera is still travelling. The field keeps flowing underneath —
      // see openImage, which no longer freezes anything on this path.
      if (phaseRef.current === "inside") {
        clickedTile.current = i;
        onImageOpen(tiles[i].texIndex);
      }
      return;
    }
    // (Archived) second click inside → unwrap to the grid.
    if (!unwrapRequest.current) {
      unwrapRequest.current = true;
      clickedTile.current = i;
    }
  };

  return (
    <>
      {tiles.map((tile, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
          onClick={onTileClick(i)}
        >
          {/* Photo, split into a FRONT face (seen from outside the globe + in
              the grid) and a BACK face with a pre-flipped texture (seen from
              the centre) so the logo reads the right way round from every view.
              alphaTest + depthWrite (rather than pure alpha blending) is what
              keeps the cut-out marks clean: the white backing plane used to be
              the only depth-writing mesh, and without it blend-only tiles
              stopped occluding each other and rendered as dark/blocky squares
              wherever the back-to-front sort got it wrong. Discarding the
              transparent texels instead lets every tile write depth again. */}
          <mesh renderOrder={1}>
            <planeGeometry args={[PHOTO_INSET, PHOTO_INSET]} />
            <meshBasicMaterial
              map={textures[tile.texIndex]}
              map-colorSpace={THREE.SRGBColorSpace}
              map-anisotropy={8}
              side={THREE.FrontSide}
              toneMapped={false}
              transparent
              alphaTest={0.4}
            />
          </mesh>
          <mesh renderOrder={1}>
            <planeGeometry args={[PHOTO_INSET, PHOTO_INSET]} />
            <meshBasicMaterial
              map={flippedTextures[tile.texIndex]}
              side={THREE.BackSide}
              toneMapped={false}
              transparent
              alphaTest={0.4}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

/**
 * SeasonsGlobe — the club globe as an embeddable landing-page section (the
 * "Seasons" section, id="seasons"). Renders only the section: the page already
 * supplies the shared Unicorn background and the footer.
 *
 * Flow: the globe sits and spins → click it to fly INSIDE → click a photo in
 * the drifting field to expand it to the centre with its title/date, over a
 * field that keeps flowing. (The third view — unwrap into the scrolling grid —
 * is ARCHIVED behind GRID_ARCHIVED above; reduced motion still uses it.)
 */
export default function SeasonsGlobe() {
  const { prefersReducedMotion } = useDeviceDetect();
  const sectionRef = useRef<HTMLElement>(null);

  const expandRequest = useRef(false);
  const unwrapRequest = useRef(false);
  const clickedTile = useRef(Math.floor(TILE_COUNT / 2));
  const phaseRef = useRef<Phase>(prefersReducedMotion ? "grid" : "globe");

  const [phase, setPhase] = useState<Phase>(
    prefersReducedMotion ? "grid" : "globe",
  );
  const [visible, setVisible] = useState(false); // section near viewport → run
  const [expanded, setExpanded] = useState<number | null>(null); // texIndex
  const [lightboxShown, setLightboxShown] = useState(false);

  // ── Drag through the field ────────────────────────────────────────────────
  // Pointer only. The reference drives its field from the wheel as well, but
  // this section sits in the middle of a Locomotive-scrolled page and has never
  // captured the wheel: taking it would strand the visitor here with no way to
  // reach the footer unless we also locked and unlocked page scroll around it.
  const drag = useRef<DragState>({ xTarget: 0, yTarget: 0 });
  const didDrag = useRef(false);
  const pressed = useRef(false);
  const pressStart = useRef({ x: 0, y: 0 });
  const pressLast = useRef({ x: 0, y: 0 });

  const fieldLive = phase === "inside";

  const onPointerDown = (e: React.PointerEvent) => {
    didDrag.current = false;
    if (!fieldLive) return;
    pressed.current = true;
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressLast.current = { x: e.clientX, y: e.clientY };
    // Deliberately NOT capturing yet — capturing on pointerdown swallows the
    // click that R3F needs to advance the phase, so a plain tap on a mark would
    // never open the grid. Capture only once this is definitely a drag.
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pressed.current) return;

    if (!didDrag.current) {
      const dx = e.clientX - pressStart.current.x;
      const dy = e.clientY - pressStart.current.y;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      didDrag.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    const dx = e.clientX - pressLast.current.x;
    const dy = e.clientY - pressLast.current.y;
    pressLast.current = { x: e.clientX, y: e.clientY };

    drag.current.xTarget -= dx * DRAG_SENSITIVITY;
    // Touch keeps its vertical axis: `touch-action: pan-y` below hands vertical
    // gestures to the browser so the page can still scroll off this section on
    // a phone, and the two must agree about who owns that axis.
    if (e.pointerType !== "touch") {
      drag.current.yTarget += dy * DRAG_SENSITIVITY;
    }
  };

  const endPress = (e: React.PointerEvent) => {
    pressed.current = false;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Cursor splash — ONLY on the expanded photo, same as the Careers lightbox.
  // The globe itself is WebGL, so there is no DOM <img> to attach to until a
  // tile is opened; gating on `expanded` also means no GL context is created
  // until then. The host is the wrapper immediately around the <img> so the
  // canvas lands in the same box, and inherits the same rounding and shadow.
  const splashRef = useRef<HTMLDivElement>(null);
  useSplashHover(splashRef, expanded !== null);
  const lightboxImgRef = useRef<HTMLImageElement>(null);
  const lightboxCapRef = useRef<HTMLElement>(null);
  const trail = useImageTrail();
  // Filled in by <Scene>, which is the only place that can see the camera.
  const tileRect = useRef<TileRectFn | null>(null);
  const handleTileRect = useCallback((fn: TileRectFn | null) => {
    tileRect.current = fn;
  }, []);
  const freezeGrid = useRef(false);

  // Only run the canvas while the section is near the viewport (it's the last
  // section on a long page — no need to render 252 tiles the whole time).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "10%" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Poll the phase the Scene writes each frame (compiler-safe: the Scene
  // mutates the passed ref inside useFrame; here we lift it to state on change).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setPhase((cur) => (phaseRef.current !== cur ? phaseRef.current : cur));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const openImage = (texIndex: number) => {
    // Freeze ONLY the grid, and only when the grid is actually up (the
    // reduced-motion / un-archived path). The field is a different case: it
    // keeps flowing behind the open image on purpose — the section must never
    // read as hung — and it can afford to, because the trail's origin is a
    // GETTER resolved at play time: the exit flies the clones to wherever the
    // clicked mark has drifted BY THEN, and if it has wrapped out of view the
    // trail falls back to the click point rather than chasing a ghost.
    if (phaseRef.current === "grid") freezeGrid.current = true;
    trail.captureOrigin(() => tileRect.current?.(clickedTile.current) ?? null);
    setExpanded(texIndex);
  };

  // Close through the trail: the photo wipes off and the clones fly back to the
  // grid tile that was clicked. Unmount happens on completion — the image must
  // still be mounted for there to be anything to animate.
  const closeImage = () => {
    setLightboxShown(false);
    const img = lightboxImgRef.current;
    if (prefersReducedMotion || !img || expanded === null) {
      freezeGrid.current = false;
      window.setTimeout(() => setExpanded(null), 320);
      return;
    }
    trail.exit(
      img,
      IMAGES[expanded].src,
      () => setExpanded(null),
      // Resume only once the LAST clone has landed — not when the image has
      // finished wiping off, which happens well before them.
      () => {
        freezeGrid.current = false;
      },
    );
  };

  useEffect(() => {
    if (expanded === null) return;
    const raf = requestAnimationFrame(() => setLightboxShown(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeImage();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Entrance: the grid tiles are WebGL, so there is no element to measure —
  // the hook flies the trail in from the point that was clicked.
  useEffect(() => {
    if (expanded === null) return;
    const img = lightboxImgRef.current;
    if (!img) return;
    if (prefersReducedMotion) {
      img.style.clipPath = "none";
      return;
    }
    trail.enter(img, IMAGES[expanded].src, lightboxCapRef.current);
  }, [expanded, prefersReducedMotion, trail]);

  const img = expanded !== null ? IMAGES[expanded] : null;
  const showEnterHint = phase === "globe";
  const showInsideHint = phase === "inside";
  const gridActive = phase === "grid";

  return (
    <section
      ref={sectionRef}
      id="seasons"
      aria-label="Seasons"
      className="relative h-dvh w-full overflow-hidden"
      // The globe's on-screen diameter: GLOBE_FILL of the shorter side (see
      // camRest). The section is full-width and h-dvh, so vw/dvh are its size.
      style={
        {
          "--globe-d": `calc(${GLOBE_FILL} * min(100vw, 100dvh))`,
        } as React.CSSProperties
      }
    >
      <h2 className="sr-only">Seasons — a living archive</h2>
      <div
        className="absolute inset-0 cursor-pointer"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        // Only while the field is live, and only the horizontal axis: the
        // browser keeps vertical gestures, so a phone can still scroll past
        // this full-height section instead of being caught by the drag.
        style={fieldLive ? { touchAction: "pan-y" } : undefined}
      >
        <Canvas
          className="absolute inset-0"
          frameloop={visible ? "always" : "never"}
          camera={{ position: [0, 0, 17], fov: FOV_GLOBE, near: 0.1, far: 100 }}
          dpr={[1, 2]}
          onPointerMissed={() => {
            // A click that misses a photo (a gap) still advances the ENTRY —
            // unless it was a drag through the empty space between marks. With
            // the grid archived it advances nothing further: inside the field,
            // a miss is just a miss, and only a mark itself opens.
            if (didDrag.current) return;
            if (prefersReducedMotion || phaseRef.current === "grid") return;
            if (!expandRequest.current) expandRequest.current = true;
            else if (!GRID_ARCHIVED && !unwrapRequest.current)
              unwrapRequest.current = true;
          }}
        >
          <Suspense fallback={null}>
            <Scene
              instant={prefersReducedMotion}
              expandRequest={expandRequest}
              unwrapRequest={unwrapRequest}
              clickedTile={clickedTile}
              phaseRef={phaseRef}
              onImageOpen={openImage}
              drag={drag}
              didDrag={didDrag}
              onTileRect={handleTileRect}
              freezeGrid={freezeGrid}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Floor shadow — the streak under the globe in the reference (see the
          SHADOW_* constants). Sized off the globe's on-screen diameter, which
          GLOBE_FILL pins to the viewport's shorter side, so it stays glued to
          the bottom of the globe at every size. Only while the globe is at
          rest — once it has been opened the camera is inside it. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute transition-opacity duration-300 ${showEnterHint ? "opacity-100" : "opacity-0"}`}
        style={{
          left: `calc(50% + var(--globe-d) * ${SHADOW_OFFSET_X})`,
          top: `calc(50% + var(--globe-d) * ${0.5 + SHADOW_GAP})`,
          width: `calc(var(--globe-d) * ${SHADOW_WIDTH})`,
          height: `calc(var(--globe-d) * ${SHADOW_HEIGHT})`,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse at center, rgba(0,0,0,${SHADOW_ALPHA}) 0%, rgba(0,0,0,${SHADOW_ALPHA * 0.6}) 45%, rgba(0,0,0,0) 72%)`,
          filter: "blur(1.5px)",
        }}
      />

      {/* Immersion side-blur — only in the grid view, mirroring the reference:
          the columns dissolve into a frosted vignette at the left/right edges. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-[16%] backdrop-blur-md transition-opacity duration-700 ${gridActive ? "opacity-100" : "opacity-0"}`}
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, #000 0%, #000 25%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, #000 0%, #000 25%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-[16%] backdrop-blur-md transition-opacity duration-700 ${gridActive ? "opacity-100" : "opacity-0"}`}
        style={{
          WebkitMaskImage:
            "linear-gradient(to left, #000 0%, #000 25%, transparent 100%)",
          maskImage:
            "linear-gradient(to left, #000 0%, #000 25%, transparent 100%)",
        }}
      />

      {/* Phase hints — parked in the clear strip well under the globe rather
          than at bottom-[8vh], where the line landed over the lower band of
          tiles and was practically unreadable against them. The globe's bottom
          edge sits at a fixed fraction of the section height (GLOBE_FILL frames
          it against the viewport's shorter side), so a fixed offset holds the
          line below it at every size — hence a vh offset, dropped to 2vh so
          the line sits clear of the tiles rather than tucked under them.
          safe-bottom keeps it off the home indicator on phones. */}
      <div
        // Spans the full width and centres its content, rather than sitting at
        // left-1/2 with a -50% shift: an absolutely-positioned shrink-to-fit box
        // at left:50% can only ever be as wide as the space from the midpoint to
        // the right edge — 195px on a 390px phone — so the line wrapped to two
        // there while staying on one line on desktop. whitespace-nowrap keeps it
        // to a single line regardless. Sits a touch lower on phones.
        // An interaction hint, so it stays on the plain mono (--font-hint) rather
        // than following --font-mono onto Departure with the rest of the site.
        style={{ fontFamily: "var(--font-hint)" }}
        className={`pointer-events-none absolute bottom-[calc(var(--safe-bottom,0px)+1.1vh)] md:bottom-[calc(var(--safe-bottom,0px)+2vh)] left-0 right-0 flex items-center justify-center gap-2 whitespace-nowrap text-[0.62rem] uppercase tracking-[0.3em] text-white/75 transition-opacity duration-500 ${showEnterHint || showInsideHint ? "opacity-100" : "opacity-0"}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#c4010d]" />
        {showInsideHint ? "Click a photo to open it" : "Click the world to enter"}
      </div>

      {/* Expand-to-centre lightbox — photo grows to the middle with its title
          and date to the side (like the Careers page). */}
      {img && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${img.title} — expanded`}
          onClick={closeImage}
        >
          <div
            className={`absolute inset-0 bg-[#1a070d]/85 backdrop-blur-md transition-opacity duration-300 ${lightboxShown ? "opacity-100" : "opacity-0"}`}
          />
          {/* Mirrors the navbar toggle on the opposite side: same safe-area
              offsets, same 14/16 square with the 10px radius and liquid-glass
              treatment — so the ✕ and the hamburger read as one pair sitting
              on the same line. Keep in sync with <Navbar>'s toggle and the
              matching button in CareerGallery. */}
          <button
            type="button"
            onClick={closeImage}
            aria-label="Close"
            className="liquid-glass absolute top-[calc(var(--safe-top)+1rem)] right-[calc(var(--safe-right)+0.75rem)] z-[2] flex h-14 w-14 items-center justify-center rounded-[10px] text-white/80 hover:text-white md:top-[calc(var(--safe-top)+1.5rem)] md:right-[calc(var(--safe-right)+1.25rem)] md:h-16 md:w-16"
          >
            <ChromaticMetal />
            <span className="text-2xl leading-none">×</span>
          </button>
          <figure
            onClick={(e) => e.stopPropagation()}
            // Opacity only — the scale/translate that used to be here moved the
            // photo during the entrance, so the clones were flying to a target
            // that had not settled yet. The trail is the entrance now; this
            // fades the caption in beside it.
            className={`relative z-[1] flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${lightboxShown ? "opacity-100" : "opacity-0"}`}
          >
            {/* The rounding and shadow live on this wrapper, not the <img>:
                the splash canvas is a sibling inside it, so both survive the
                swap between the two (overflow-hidden clips the canvas to the
                same corners; a box shadow paints outside the box and so is
                unaffected by the clip). */}
            <div
              ref={splashRef}
              className="relative overflow-hidden rounded-[4px] shadow-[0_30px_90px_-25px_rgba(0,0,0,0.8)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={lightboxImgRef}
                src={img.src}
                alt={img.title}
                className="block max-h-[64vh] w-auto object-cover"
                // Starts clipped so nothing shows before the entrance runs.
                // clip-path does not affect layout, so the photo sits exactly
                // where it always did.
                style={
                  prefersReducedMotion
                    ? undefined
                    : { clipPath: TRAIL_HIDDEN_CLIP }
                }
              />
            </div>
            <figcaption
              ref={lightboxCapRef}
              className="flex flex-col items-center text-center sm:items-start sm:text-left"
            >
              <span className="text-[11px] uppercase tracking-[0.24em] text-white/55">
                {img.date}
              </span>
              <span className="mt-2 text-2xl font-medium text-white sm:text-3xl">
                {img.title}
              </span>
              <span className="mt-4 h-px w-16 bg-white/25" />
              <span className="mt-4 max-w-[26ch] text-sm leading-relaxed text-white/60">
                A frame from the Zuhayr Creative archive.
              </span>
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
