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
import { createPortal } from "react-dom";
import * as THREE from "three";
import {
  Canvas,
  useFrame,
  useLoader,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import { sceneDprCap } from "@/app/lib/device";
import { useSplashHover } from "./useSplashHover";
import ChromaticMetal from "./ChromaticMetal";
import { useImageTrail, TRAIL_HIDDEN_CLIP } from "@/app/animations/useImageTrail";
import type { TrailRect } from "@/app/animations/repeatingImageTransition";
import { SEASONS_IMAGES as IMAGES } from "./seasonsImages";

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
// PARKED AT 0. The client asked for the globe dead centre with the camera
// straight on: the line of sight runs along +z through the globe's centre,
// so the disc sits in the middle of the frame and no part of the shell is
// seen from above. The measurement above is kept because the elevated view
// is what both reference reels show — every formula below still reads
// CAM_ELEV, so putting the angle back is this one number.
const CAM_ELEV = 0; // rad — was 1.08 (≈ 62° above the equator)
const FOV_INSIDE = 62; // wide, curved view from inside
const FOV_GRID = 45; // frames the flat grid
/**
 * How much of the viewport's SHORTER side the globe's radius fills at rest —
 * 0.8 spans 80% of the height on a landscape screen and 80% of the width on
 * a phone, centred, so there is a clear 10% above and below it: room for the
 * top of the globe, and for the hint line under it. The
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
// client describes as the images "moving freely". It holds there for
// HOLD_DUR — the reel's own hold is ~0.7s — and then the shell opens out
// into the drag field (the third stage: drag to explore, click a mark to
// open it), the camera gliding the last stretch to the centre over the same
// window so the opening reads as the depth continuing to unfold.
// ── The entry, as the client re-specified it (23 Sep) ──
// "On clicking the globe the images on the RIGHT side of the globe open and
// make a hole — don't hide them, make them move on their own in a formation
// — and the camera goes inside the hole." So the click first opens the
// hole (HOLE_*, below) while the camera waits CAM_DELAY; then the camera
// swings round from the front toward the hole as it dollies in, arriving
// square in front of it just as it reaches the shell, and passes through.
// The swing is what takes longer than the old straight 0.63s dolly.
const CAM_DELAY = 0.65; // the hole opens fully before the camera moves
const ENTRY_DUR = 1.15; // camera: rest → through the hole → inside
/** Fraction of the entry by which the camera is square on to the hole. */
const ENTRY_AIM = 0.7;
const HOLD_DUR = 0.5; // inside the intact shell before it opens
/** Where the camera stops: inside the shell, as a fraction of the radius. */
const CAM_HOLD = SPHERE_R * 0.85;
/** How long the shell takes to open into the field once the hold is over. */
const FIELD_OPEN_DUR = 1.15;
// ── The hole the camera goes through ──
//
// A patch of the shell on the globe's RIGHT side opens like an iris. Every
// mark inside HOLE_ANG + HOLE_BAND of the hole's centre slides ALONG the
// shell, away from the centre, into the band round the opening — the ones
// from the middle travelling furthest — and twists a little about the hole's
// axis as it goes, so the opening reads as a formation turning open rather
// than marks being shoved aside. Nothing is hidden: every mark stays on the
// shell, full size, standing a touch proud of it (HOLE_LIFT) so the gathered
// ring layers over its neighbours instead of fighting them for depth. The
// opening ripples out from the centre (HOLE_RIPPLE), and each mark gets
// there through its own under-damped spring (HOLE_SPRING_K_*), so they
// arrive and settle at their own rates — the "moving on their own".
//
// The spin eases to a stop on the click (SPIN_STOP), so the formation holds
// still for the camera to fly into.
/** Where the hole is: this far round to the RIGHT of the line of sight. */
// ≈29°: the opening faces the viewer on the RIGHT half of the disc (its
// centre ~0.48R right of the middle) instead of wrapping round the limb,
// where it would be seen edge-on and half hidden.
const HOLE_AZ = 0.5;
/** The opening's angular radius on the shell. */
const HOLE_ANG = 0.45; // rad — ≈2.6 world units of radius on the shell at R 6
/** The ring of shell the opened marks are gathered into, outside the opening. */
const HOLE_BAND = 0.32; // rad — the whole ring stays on the visible face
/** Twist of the iris about the hole's axis, for the marks from the middle. */
const HOLE_SWIRL = 0.55; // rad
/**
 * Extra radius for a gathered mark, as a fraction of R, fading to 0 at the
 * band's edge — and how much bigger it grows. The globe is see-through, so a
 * gap in the near side is filled in by the far side's marks behind it; what
 * makes the opening READ is the ring round it standing well proud of the
 * shell and larger than everything else, like petals opening, with the far
 * wall small and distant through the middle.
 */
const HOLE_LIFT = 0.3;
const HOLE_GROW = 0.5;
/** Seconds for the opening to ripple from the hole's centre to its edge. */
const HOLE_RIPPLE = 0.25;
/** Time constant the spin eases to a stop with, on the click. */
const SPIN_STOP = 0.1;
// Each mark has its own stiffness, spread between these, so the ring of
// marks round the hole does not swing in unison — they arrive and settle at
// their own rates, which is what reads as moving freely rather than as one
// mechanism. Damping is well under critical for the same reason.
const HOLE_SPRING_K_MIN = 90;
const HOLE_SPRING_K_MAX = 220;
const HOLE_SPRING_C = 6.5;
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
//
// The old 0.16 was 2.4x too slow; that is most of what "the way the globe is
// moving" was about.
// LIVE again at the reference's own rate. The client asked for the globe to
// turn to the RIGHT, gently but without looking slow, and 0.38 is the value
// that brief already settled once: the fit above measured it off the client's
// clip, and the 0.16 it replaced was rejected in as many words for being too
// slow. Positive turns the NEAR side left → right, which is the direction
// asked for; because the spin is premultiplied by the lean the globe turns
// about its own left-leaning axis, so the marks ride up to the right along
// the bands instead of running flat across them.
//
// One caveat on how fast this now READS. The rate is unchanged, but the
// camera is no longer 62° overhead (see CAM_ELEV): looking at the equator
// dead-on, the marks cross the disc at their full tangential speed rather
// than swirling round the pole, so the same 0.38 rad/s carries a mark over
// the visible face in about 5.5s. If it ever reads fast, this is why — and
// this constant is the only thing to move.
const SPIN_SPEED = 0.38; // rad/s — 21.6°/s, one turn every 16.7s, to the right
/** Hover: vertical drift as a fraction of the radius, and its period. */
const FLOAT_AMP = 0; // was 0.012 — still parked; the globe holds dead centre
const FLOAT_PERIOD = 7; // seconds, up and back
// ── The lean ──
//
// In the reference the bands, and every card on them, lean ~12° in the
// picture: an edge-orientation histogram over the disc of Screen Recording
// 2026-08-27 060825 reads +10.9° to +12.4° across the whole clip. Ours read
// -0.6° — dead straight — for two reasons. The lean was a roll about the
// world's Z axis, which the camera, 62° overhead, sees mostly end-on; and the
// marks are stood upright to the camera, so none of them carried the lean
// either, even where the bands did.
//
// So the lean is a roll about the camera's line of sight — the picture plane
// itself, whatever CAM_ELEV is — and the marks take it too: each is turned on
// the shell so its bars lean by the same angle on screen (see MARK_ALIGN), so
// they still all read identical, only leaning with the bands the way the
// reference's cards do.
// The spin happens INSIDE the lean (see the premultiply in the frame loop),
// so the globe turns about its own leaned axis instead of wobbling.
//
// SIGN: positive is counter-clockwise on screen — top edges and bands rise to
// the right, bottom-left → top-right, which is the brief. (The bands, not the
// invisible axis, are what a direction is specified against.)
//
// MAGNITUDE: the same histogram reads a little under the true angle on the Z
// marks (their diagonal stroke pulls the peak down) — 0.21 measured +8…+10°
// — so 0.235 is what lands the site on the reference's +11…+12°.
// LIVE again, unlike the spin and the float either side of it: the client
// asked to see the globe leaning to the LEFT. Positive is counter-clockwise
// on screen, which carries the north pole left and the bands up to the
// right — the reference's own direction — so the measured value is what
// goes back in. With CAM_ELEV at 0 the roll axis is the line of sight
// dead-on, so the whole lean reads at full strength instead of being seen
// end-on the way the 62° view saw most of it.
const TILT_ROLL = 0.235; // rad, ≈ +13.5° — north pole to the LEFT
// How the marks take the lean. Each mark's horizontal edge is a blend of two
// directions on its patch of shell: the leaned right PROJECTED onto the shell,
// which is steady from any angle but shrinks the lean the further the mark is
// from the middle of the disc (from 62° up, 12° read as 7°), and the edge that
// lands on SCREEN exactly along the leaned right, which holds the lean out to
// the rim but swings wildly on a mark seen nearly edge-on — the marks the
// camera passes on its way in. The blend weights the exact edge by how
// face-on the mark is (squared), so the disc reads at the full lean and the
// grazing marks by the lens stay calm.
const MARK_ALIGN = 1;
// (No floor shadow under the globe: the client asked for it to be removed.)
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
// "You can drag them easily": the field follows the pointer 1:1 — a drag
// moves the marks at the field's reference depth exactly as far as the
// pointer moved (the drag is sent in viewport heights, the Scene turns it
// into world units there) — and a flick carries on, gliding out over
// DRAG_GLIDE rather than stopping dead when the finger lifts. The follow is
// frame-rate independent (DRAG_FOLLOW is a time constant, not a per-frame
// fraction, which ran twice as fast on a 120Hz screen as on a 60Hz one).
const DRAG_FOLLOW = 0.07; // s — how quickly the field catches the pointer
const DRAG_GLIDE = 0.45; // s — how long a flick keeps going
const DRAG_THRESHOLD = 6; // px of travel before a press counts as a drag

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

/**
 * LIVE again (23 Sep): the click opens a hole on the globe's right side and
 * flies the camera in through it, into the field (see HOLE_* and CAM_DELAY).
 * It was parked for a while when the client wanted a scroll entrance; set
 * this to false to park it again — the globe then just sits and spins.
 */
const CLICK_ENTRY = true;

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
  /** Where the pointer has dragged the field to, in viewport heights. */
  xTarget: number;
  yTarget: number;
  /** The flick at release, in viewport heights per second. */
  vx: number;
  vy: number;
  /** Bumped on every release (to start a glide) and every press (to stop one). */
  releaseId: number;
  pressId: number;
}

/**
 * The Zuhayr "Z" rendered as a city / culture skin — the brand "seasons".
 * Transparent PNGs rendered with no backing plane, so each mark sits directly
 * on the scene. Titles and dates feed the expand-to-centre panel (like the
 * Careers page). Add more here as they're produced.
 * The list itself lives in seasonsImages.ts — SeasonsGlobeLazy warms the
 * files during idle time and cannot import this module to find out which,
 * because this module is the three.js payload. `src` there is the optimizer's
 * URL, not the 2000px original.
 */

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
// The lean is constant, so it is built once, not per frame: TILT_ROLL about
// the rest camera's line of sight, taken from the globe's centre toward the
// camera so that positive turns the picture counter-clockwise. The camera
// only ever moves along that line on the way in, so the lean holds through
// the dolly as well.
const _tilt = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, Math.sin(CAM_ELEV), Math.cos(CAM_ELEV)),
  TILT_ROLL,
);
// The field is built looking down -z with +y up (see fieldPosOf) and then
// turned to lie along the camera's line of sight, which is CAM_ELEV above
// the horizontal: a pitch of -CAM_ELEV takes -z to the direction the camera
// looks and +y to the camera's up. In the field the marks face the camera,
// so this is also their orientation there.
//
// The camera now finishes on the line through the HOLE rather than the rest
// line of sight (see HOLE_AZ), so the field is laid along that line: its +z
// is the hole's direction and its +y the world's up, which is exactly the
// frame of a camera sitting on that line and looking at the centre. With
// HOLE_AZ at 0 this is the old pitch of -CAM_ELEV.
/** The rest camera's direction from the globe's centre. */
const _restDir = new THREE.Vector3(0, Math.sin(CAM_ELEV), Math.cos(CAM_ELEV));
/** The hole's centre, as a direction from the globe's centre: HOLE_AZ round to the right of the rest camera. */
const _holeDir = new THREE.Vector3(1, 0, 0)
  .multiplyScalar(Math.sin(HOLE_AZ))
  .addScaledVector(_restDir, Math.cos(HOLE_AZ))
  .normalize();
/** The camera's swing from the rest line onto the hole's line. */
const _aimQ = new THREE.Quaternion().setFromUnitVectors(_restDir, _holeDir);
const _fieldQ = (() => {
  const z = _holeDir.clone();
  const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
  const y = z.clone().cross(x);
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(x, y, z),
  );
})();
const _sphereQuat = new THREE.Quaternion();
const _spherePos = new THREE.Vector3();
const _gridPos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _IDENTITY_QUAT = new THREE.Quaternion();
const _fieldPos = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _xAxis = new THREE.Vector3(1, 0, 0);
const _camDir = new THREE.Vector3();
const _partQ = new THREE.Quaternion();
const _tangent = new THREE.Vector3();
const _swirlQ = new THREE.Quaternion();
const _target = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _mat = new THREE.Matrix4();
const _camUp = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _tNormal = new THREE.Vector3();
const _tUp = new THREE.Vector3();
const _tRight = new THREE.Vector3();
const _view = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _push = new THREE.Vector3();
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
  /** This mark's spring stiffness for making way (see HOLE_SPRING_K_MIN). */
  springK: number;
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

/** Tell three.js an instanced mesh's matrices changed this frame (its back
 *  twin shares the buffer, so one flag covers both). */
const flagMatricesDirty = (m: THREE.InstancedMesh) => {
  m.instanceMatrix.needsUpdate = true;
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
  /* ── One geometry, eight materials, 504 meshes ──
     Every tile used to declare its own <planeGeometry> and <meshBasicMaterial>
     inside the map, so mounting the globe built 252 x 2 of each: a thousand
     objects for four distinct looks, every one of them a separate React
     element for react-three-fiber to create, attach and dispose. They are all
     identical bar the texture, so they are built once here and handed to the
     meshes as props. The meshes stay — each tile still moves on its own — but
     the scene graph underneath them is four materials, four flipped ones and
     a single plane. This is the largest part of what the reader waits through
     on the way in, and it is the same picture on the way out. */
  const photoGeo = useMemo(
    () => new THREE.PlaneGeometry(PHOTO_INSET, PHOTO_INSET),
    [],
  );
  const frontMats = useMemo(
    () =>
      textures.map((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        return new THREE.MeshBasicMaterial({
          map: t,
          side: THREE.FrontSide,
          toneMapped: false,
          transparent: true,
          alphaTest: 0.4,
        });
      }),
    [textures],
  );
  const backMats = useMemo(
    () =>
      flippedTextures.map(
        (t) =>
          new THREE.MeshBasicMaterial({
            map: t,
            side: THREE.BackSide,
            toneMapped: false,
            transparent: true,
            alphaTest: 0.4,
          }),
      ),
    [flippedTextures],
  );
  // The section never unmounts in normal use (see useNearViewport), but these
  // hold GPU memory, so they are given back if it ever does.
  useEffect(
    () => () => {
      photoGeo.dispose();
      for (const m of [...frontMats, ...backMats]) m.dispose();
    },
    [photoGeo, frontMats, backMats],
  );

  /* A gl.compile() here — paying for the shaders before the first frame —
     was tried and removed. By the time this scene exists the canvas's frame
     loop is already running (the section passes its 10% visibility gate long
     before the scene finishes mounting), so the first frame has already been
     drawn when an effect could run: the compile was 342ms of duplicate work
     AFTER the thing it was meant to make cheaper. The way to give the mount
     room is to start it earlier, which is what SeasonsGlobeLazy's approach
     margin does. */
  // Where each tile is right now — the projector (projectTile) reads these;
  // there is no per-tile Object3D any more to ask.
  const tilePos = useRef(new Float32Array(TILE_COUNT * 3));
  const tileScale = useRef(new Float32Array(TILE_COUNT));
  const start = useRef(-1);
  const spinRate = useRef(1); // eases to 0 on the click — see SPIN_STOP
  const time = useRef(0); // the timeline's clock — see the frame loop
  const scroll = useRef(0);
  const spinAngle = useRef(0); // accumulated (dt-based) so it survives frameloop pauses
  const unwrapStart = useRef(-1);
  const gridReady = useRef(false);
  const fieldFlow = useRef(0);
  // Damped follow of the drag targets the section writes. Owned here so the
  // frame loop only ever READS the incoming ref.
  const dragCurrent = useRef({ x: 0, y: 0 });
  // The flick after a release, and which press/release the Scene has seen.
  const glide = useRef({ x: 0, y: 0, vx: 0, vy: 0, press: 0, release: 0 });
  // Per-mark spring state for making way (see HOLE_R): offset xyz, then
  // velocity xyz, six floats a mark.
  const springs = useRef(new Float32Array(TILE_COUNT * 6));
  // Per-mark size for the hole's ring (see HOLE_GROW), eased toward its target.
  const grow = useRef(new Float32Array(TILE_COUNT).fill(1));

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
      // Orientation is NOT stored: a mark lies flat on the shell (its +Z is
      // the outward normal) and is turned so that it reads upright to the
      // camera — see the frame loop. That has to be done per frame, because
      // the spin moves the mark and the entry moves the camera.
      return {
        gridCol: i % GRID_COLS,
        gridRow: Math.floor(i / GRID_COLS),
        dir: columnDir(i % GRID_COLS),
        sphereDir,
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
        springK:
          HOLE_SPRING_K_MIN +
          hash01(i * 13 + 5) * (HOLE_SPRING_K_MAX - HOLE_SPRING_K_MIN),
      };
    });
  }, [textures.length]);

  /* ── One InstancedMesh per photograph and side, not one mesh per tile ──
     The 252 marks used to be 252 groups of two meshes each: 504 draw calls a
     frame, every one with its own matrix update, uniform upload and depth
     sort, which measured 9ms of a throttled phone's frame at rest (53fps,
     19 late frames in 3s). All of a photograph's marks share a geometry and
     a material, so they are one InstancedMesh — four photographs, a front
     and a back each: eight draw calls. The front and back share ONE matrix
     buffer, so each frame uploads it once.

     Clicks still land on the right mark: react-three-fiber reports the
     instance, and `list` maps it back to the tile. The raycast's bounding
     sphere is set once, huge — three.js would otherwise compute it from the
     instances' positions the first time it raycast and keep it, and the
     marks move, so clicks outside where they happened to be would be
     dropped. Frustum culling is off for the same reason (the marks leave
     their geometry's bounds). */
  const inst = useMemo(() => {
    const lists: number[][] = frontMats.map(() => []);
    const slot = new Int32Array(TILE_COUNT);
    tiles.forEach((t, i) => {
      slot[i] = lists[t.texIndex].length;
      lists[t.texIndex].push(i);
    });
    const meshes = lists.map((list, tex) => {
      const front = new THREE.InstancedMesh(photoGeo, frontMats[tex], list.length);
      const back = new THREE.InstancedMesh(photoGeo, backMats[tex], list.length);
      front.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      back.instanceMatrix = front.instanceMatrix;
      for (const m of [front, back]) {
        m.frustumCulled = false;
        m.renderOrder = 1;
        m.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
      }
      return { front, back, list };
    });
    return { meshes, slot };
  }, [tiles, photoGeo, frontMats, backMats]);
  // The frame loop writes into the meshes' buffers, so it reaches them
  // through a ref (the React Compiler rightly refuses writes into a memoised
  // value).
  const instRef = useRef(inst);
  useEffect(() => {
    instRef.current = inst;
  }, [inst]);
  useEffect(
    () => () => {
      for (const m of inst.meshes) {
        m.front.dispose();
        m.back.dispose();
      }
    },
    [inst],
  );

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
      if (!glCanvas || i < 0 || i >= TILE_COUNT) return null;
      const canvas = glCanvas.getBoundingClientRect();
      if (!canvas.width || !canvas.height) return null;

      const tp = tilePos.current;
      _projCentre.set(tp[i * 3], tp[i * 3 + 1], tp[i * 3 + 2]);
      _projEdge.copy(_projCentre);
      _projEdge.x += (tileScale.current[i] * PHOTO_INSET) / 2;

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
    // The timeline's own clock, accumulated from the frame delta — NOT
    // state.clock.elapsedTime. react-three-fiber zeroes that clock whenever
    // the frameloop prop changes, and this canvas switches between "always"
    // and "demand" every time the section scrolls in or out of view. Against
    // a zeroed clock the click time held in `start` lay in the future: the
    // camera snapped back outside the globe the moment the section left the
    // view (even behind an open photo), and on the way back the whole entry
    // played again by itself, as many seconds later as the click had come
    // after the section last appeared. Capped per frame so the first frame
    // after a pause does not throw the entry forward.
    time.current += Math.min(rawDt, 0.1);
    const clock = time.current;
    const I = instRef.current;

    // The entry only begins once the globe has been clicked (or reduced
    // motion jumps straight in). Until then the globe just sits and spins.
    const running = expandRequest.current || instant;
    if (running && start.current < 0) {
      start.current = clock;
    }
    const elapsed = !running ? 0 : clock - start.current;

    // "How far in are we" — the dolly's 0→1 from the click (see "The
    // opening"). Everything downstream (the unwrap gate, the phase) means
    // this by `approach`.
    // (The camera waits CAM_DELAY while the hole opens, then takes ENTRY_DUR.)
    const approach = instant
      ? 1
      : running
        ? THREE.MathUtils.clamp((elapsed - CAM_DELAY) / ENTRY_DUR, 0, 1)
        : 0;
    // The camera's two motions through the entry. It is square on to the
    // hole by ENTRY_AIM — the moment it reaches the shell — and dollies in
    // throughout, easing in and out, so it arrives inside at rest.
    const aim = easeInOut(THREE.MathUtils.clamp(approach / ENTRY_AIM, 0, 1));
    const dolly = easeInOut(approach);
    // How far the shell has opened into the field: from the end of the hold,
    // over FIELD_OPEN_DUR. Reduced motion never builds a field — it goes
    // straight to the grid.
    const opening =
      instant || !running
        ? 0
        : easeInOut(
            THREE.MathUtils.clamp(
              (elapsed - CAM_DELAY - ENTRY_DUR - HOLD_DUR) / FIELD_OPEN_DUR,
              0,
              1,
            ),
          );
    // The camera's distance from the globe's centre, along its (elevated)
    // line of sight: the rest framing for this viewport, dollying in to
    // CAM_HOLD, then the last stretch to the centre as the field opens. The
    // lens is the globe's until then, and widens with the opening.
    const entry = instant
      ? { z: CAM_CENTER, fov: FOV_INSIDE }
      : opening > 0
        ? {
            z: THREE.MathUtils.lerp(CAM_HOLD, CAM_CENTER, opening),
            fov: THREE.MathUtils.lerp(FOV_GLOBE, FOV_INSIDE, opening),
          }
        : { z: THREE.MathUtils.lerp(camRest, CAM_HOLD, dolly), fov: FOV_GLOBE };

    if (
      (instant || (unwrapRequest.current && approach > 0.9)) &&
      unwrapStart.current < 0
    ) {
      unwrapStart.current = elapsed;
    }
    const unwrapElapsed =
      unwrapStart.current < 0 ? 0 : elapsed - unwrapStart.current;
    const unwrap = instant
      ? 1
      : easeInOut(THREE.MathUtils.clamp(unwrapElapsed / UNWRAP_DUR, 0, 1));

    // Spin accumulates off dt (not the wall clock) so pausing the canvas while
    // the section is scrolled away doesn't make it jump on return. Eases to a
    // stop as the globe unwraps.
    // …and stops on the click, so the hole's formation holds still for the
    // camera to fly into (see SPIN_STOP).
    spinRate.current = running
      ? spinRate.current * Math.exp(-dt / SPIN_STOP)
      : 1;
    spinAngle.current += dt * SPIN_SPEED * (1 - unwrap) * spinRate.current;
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
      // camZ out from the globe's centre, always looking at it, along a line
      // that swings from the rest line of sight onto the hole's (see
      // HOLE_AZ) as the camera comes in — so the camera flies into the hole
      // square on, and sits on the hole's line from then on: the hold, the
      // field, all of it.
      _partQ.identity().slerp(_aimQ, aim);
      _camDir.copy(_restDir).applyQuaternion(_partQ);
      camera.position.copy(_camDir).multiplyScalar(camZ);
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

    // How far the sphere has opened out into the field — the opening above.
    // Freezes at the moment the unwrap begins (archived path): from there
    // the tiles are flying to the grid, and a field still resolving
    // underneath them would drag the "from" position out from under the
    // flight.
    const fieldBlend = opening;

    // The slow hover from the reference. Wall-clock, like the spin, and damped
    // out by the unwrap so the flight to the grid starts from a still shell.
    const hover =
      Math.sin((clock * 2 * Math.PI) / FLOAT_PERIOD) *
      FLOAT_AMP *
      SPHERE_R *
      (1 - unwrap);

    // The camera's up and right in world space, turned by the lean (see
    // TILT_ROLL), for the marks to stand against (below) — so they all read
    // the same and lean with the bands. lookAt has just set the camera's
    // rotation.
    _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion).applyQuaternion(_tilt);
    _camRight.set(1, 0, 0).applyQuaternion(camera.quaternion).applyQuaternion(_tilt);

    // The hole's formation runs from the click until the unwrap (archived
    // path) — the field's opening takes the marks over from it. The springs
    // run every frame regardless, so they are what carries each mark there.
    const holeTime = running && !instant && unwrapStart.current < 0 ? elapsed : -1;
    const holeReach = HOLE_ANG + HOLE_BAND;
    _camPos.copy(camera.position);
    const sp = springs.current;

    // The cloud flows forward, and damps toward the drag the pointer asked for.
    // Both stop once the unwrap starts, for the same reason as above.
    fieldFlow.current += dt * FIELD_FLOW * (1 - unwrap);
    // The drag arrives in viewport heights; one viewport height is this many
    // world units at the field's reference depth, so the marks there move
    // exactly as far as the pointer did. A new press stops any glide; a
    // release starts one from the flick the section measured.
    const gl = glide.current;
    const d = drag.current;
    if (d.pressId !== gl.press) {
      gl.press = d.pressId;
      gl.vx = gl.vy = 0;
    }
    if (d.releaseId !== gl.release) {
      gl.release = d.releaseId;
      gl.vx = d.vx;
      gl.vy = d.vy;
    }
    gl.x += gl.vx * dt;
    gl.y += gl.vy * dt;
    const glideDecay = Math.exp(-dt / DRAG_GLIDE);
    gl.vx *= glideDecay;
    gl.vy *= glideDecay;
    const dragWorld = 2 * Math.tan((FOV_INSIDE * Math.PI) / 360) * FIELD_REF_D;
    const follow = 1 - Math.exp(-dt / DRAG_FOLLOW);
    dragCurrent.current.x +=
      ((d.xTarget + gl.x) * dragWorld - dragCurrent.current.x) * follow;
    dragCurrent.current.y +=
      ((d.yTarget + gl.y) * dragWorld - dragCurrent.current.y) * follow;
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
      ).applyQuaternion(_fieldQ);
    }

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];

      // Once the field has fully opened (and nothing is flying to the
      // archived grid) the shell plays no part in where a mark is: skip its
      // position, its spring and its upright-to-camera orientation — the
      // bulk of this loop — and go straight to the field.
      const onShell = fieldBlend < 1 || unwrapStart.current >= 0;
      if (onShell) {
      _spherePos
        .copy(tile.sphereDir)
        .applyQuaternion(_spin)
        .multiplyScalar(SPHERE_R * tile.standoff);
      _spherePos.y += hover;

      // Where this mark is asked to go for the hole: see HOLE_ANG. Measured
      // by the angle between the mark and the hole's centre, on the shell.
      _push.set(0, 0, 0);
      let growTo = 1;
      if (holeTime >= 0) {
        _tNormal.copy(tile.sphereDir).applyQuaternion(_spin);
        const cos = THREE.MathUtils.clamp(_tNormal.dot(_holeDir), -1, 1);
        const theta = Math.acos(cos);
        const f = theta / holeReach; // 0 at the centre → 1 at the band's edge
        if (f < 1 && holeTime >= f * HOLE_RIPPLE) {
          // Along the shell, straight away from the hole's centre…
          _tangent.copy(_tNormal).addScaledVector(_holeDir, -cos);
          if (_tangent.lengthSq() < 1e-8) {
            _tangent.copy(_xAxis).applyAxisAngle(_holeDir, hash01(i) * Math.PI * 2);
          }
          _tangent.normalize();
          // …to its place in the band round the opening: the middle of the
          // hole lands on the opening's rim, the band's edge stays put.
          const to = HOLE_ANG + theta * (HOLE_BAND / holeReach);
          _target
            .copy(_holeDir)
            .multiplyScalar(Math.cos(to))
            .addScaledVector(_tangent, Math.sin(to));
          // …turned a little about the hole's axis, most for the middle…
          _swirlQ.setFromAxisAngle(_holeDir, HOLE_SWIRL * (1 - f));
          _target.applyQuaternion(_swirlQ);
          // …and lifted a touch off the shell, so the ring layers cleanly.
          _target.multiplyScalar(
            SPHERE_R * tile.standoff * (1 + HOLE_LIFT * (1 - f)),
          );
          _target.y += hover;
          _push.subVectors(_target, _spherePos);
          growTo = 1 + HOLE_GROW * (1 - f);
        }
      }
      grow.current[i] += (growTo - grow.current[i]) * (1 - Math.exp(-dt / 0.18));
      // The spring: semi-implicit Euler toward the target, then the offset
      // is added to the mark's place on the shell.
      {
        const o = i * 6;
        for (let k = 0; k < 3; k++) {
          const target = k === 0 ? _push.x : k === 1 ? _push.y : _push.z;
          const x = sp[o + k];
          let v = sp[o + 3 + k];
          v += (tile.springK * (target - x) - HOLE_SPRING_C * v) * dt;
          sp[o + 3 + k] = v;
          sp[o + k] = x + v * dt;
        }
        _spherePos.x += sp[o];
        _spherePos.y += sp[o + 1];
        _spherePos.z += sp[o + 2];
      }
      // The mark lies on the shell (+Z out along the normal) and is turned
      // about that normal so its horizontal edge lands on SCREEN along the
      // leaned horizontal — the Z's top and bottom bars are what read as its
      // angle, so every mark sits at the same lean as the bands, from
      // wherever the camera is, and never pinwheels round the pole. The edge
      // is a blend of (a) and (b) below — see MARK_ALIGN for why both. (b) is
      // where the shell's tangent plane meets the plane through the camera
      // ray and the leaned right. Matching the mark's UP on screen instead
      // was tried and shears the bars off the lean.
      // Its normal is where it actually is now — a mark gathered into the
      // hole's ring faces out from its new place, not its old one.
      _tNormal.copy(_spherePos).normalize();
      // (a) the leaned right projected onto the shell — stable from any angle.
      _tUp
        .copy(_camRight)
        .addScaledVector(_tNormal, -_camRight.dot(_tNormal));
      if (_tUp.lengthSq() < 1e-12) {
        _tUp
          .copy(_camUp)
          .addScaledVector(_tNormal, -_camUp.dot(_tNormal))
          .cross(_tNormal);
      }
      _tUp.normalize();
      // (b) the edge that lands on screen exactly along the leaned right.
      _view.subVectors(_spherePos, _camPos);
      const viewLen = _view.length();
      const faceOn =
        viewLen > 1e-6 ? Math.abs(_view.dot(_tNormal)) / viewLen : 0;
      _tRight.crossVectors(_tNormal, _view.cross(_camRight));
      if (_tRight.dot(_camRight) < 0) _tRight.negate();
      const alignW =
        _tRight.lengthSq() > 1e-12 ? MARK_ALIGN * faceOn * faceOn : 0;
      if (alignW > 0)
        _tRight
          .normalize()
          .multiplyScalar(alignW)
          .addScaledVector(_tUp, 1 - alignW);
      else _tRight.copy(_tUp);
      _tRight.normalize();
      _tUp.crossVectors(_tNormal, _tRight).normalize();
      _sphereQuat.setFromRotationMatrix(
        _basis.makeBasis(_tRight, _tUp, _tNormal),
      );
      } // onShell

      fieldPosOf(
        tile,
        fieldFlow.current,
        dragX,
        dragY,
        field,
        _fieldPos,
      ).applyQuaternion(_fieldQ);

      // Where this tile is coming FROM: the sphere shell, opened out toward its
      // place in the field. In the field it faces the camera square on (the
      // field's frame, _fieldQ) — so the mark turns to face you as the globe
      // opens and never turns again.
      if (onShell) {
        _fromPos.lerpVectors(_spherePos, _fieldPos, fieldBlend);
        _fromQuat.copy(_sphereQuat).slerp(_fieldQ, fieldBlend);
      } else {
        _fromPos.copy(_fieldPos);
        _fromQuat.copy(_fieldQ);
      }

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

      _pos.lerpVectors(_fromPos, _gridPos, m);
      _quat.copy(_fromQuat).slerp(_IDENTITY_QUAT, m);

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
        grid.sphereTile * tile.sizeMul * grow.current[i],
        field.tile * emerge,
        fieldBlend,
      );
      const s = THREE.MathUtils.lerp(base, grid.tileWorld, m);
      _scale.set(s, s, s);
      _mat.compose(_pos, _quat, _scale);
      I.meshes[tile.texIndex].front.setMatrixAt(I.slot[i], _mat);
      const tp = tilePos.current;
      tp[i * 3] = _pos.x;
      tp[i * 3 + 1] = _pos.y;
      tp[i * 3 + 2] = _pos.z;
      tileScale.current[i] = s;
    }
    // One upload per photograph: the back mesh shares the front's buffer.
    for (const mesh of I.meshes) flagMatricesDirty(mesh.front);

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
    // First click → fly into the globe. Parked — see CLICK_ENTRY.
    if (!CLICK_ENTRY) return;
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

  // A click on an instance → the tile it is (see `inst`).
  const onInstanceClick = (tex: number) => (e: ThreeEvent<MouseEvent>) => {
    const id = e.instanceId;
    if (id === undefined) return;
    const i = inst.meshes[tex]?.list[id];
    if (i === undefined) return;
    onTileClick(i)(e);
  };

  return (
    <>
      {/* Each photograph's marks: a FRONT face (seen from outside the globe
          and in the field) and a BACK face with a pre-flipped texture (seen
          from inside) so the mark reads the right way round from every view.
          alphaTest + depthWrite, not pure alpha blending, is what keeps the
          cut-out marks occluding each other cleanly. */}
      {inst.meshes.map((m, tex) => (
        <group key={tex}>
          <primitive object={m.front} onClick={onInstanceClick(tex)} />
          <primitive object={m.back} onClick={onInstanceClick(tex)} />
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
  const drag = useRef<DragState>({
    xTarget: 0,
    yTarget: 0,
    vx: 0,
    vy: 0,
    releaseId: 0,
    pressId: 0,
  });
  const didDrag = useRef(false);
  const pressed = useRef(false);
  const pressStart = useRef({ x: 0, y: 0 });
  const pressLast = useRef({ x: 0, y: 0 });
  // The last few moves of a drag, for the flick's velocity at release.
  const samples = useRef<{ t: number; x: number; y: number }[]>([]);

  const fieldLive = phase === "inside";

  const onPointerDown = (e: React.PointerEvent) => {
    didDrag.current = false;
    if (!fieldLive) return;
    pressed.current = true;
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressLast.current = { x: e.clientX, y: e.clientY };
    samples.current = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
    // A new press catches the field: any glide from the last flick stops.
    drag.current.pressId += 1;
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
    const ss = samples.current;
    ss.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (ss.length > 6) ss.shift();

    // In viewport heights — the Scene turns that into exactly as far in the
    // field (see DRAG_FOLLOW), so the marks move with the pointer 1:1.
    const vh = window.innerHeight || 1;
    drag.current.xTarget -= dx / vh;
    // Touch keeps its vertical axis: `touch-action: pan-y` below hands vertical
    // gestures to the browser so the page can still scroll off this section on
    // a phone, and the two must agree about who owns that axis.
    if (e.pointerType !== "touch") {
      drag.current.yTarget += dy / vh;
    }
  };

  const endPress = (e: React.PointerEvent) => {
    // A drag that ends moving keeps going: the velocity over its last ~100ms
    // is handed to the Scene, which glides it out (DRAG_GLIDE).
    if (pressed.current && didDrag.current) {
      const ss = samples.current;
      const last = ss[ss.length - 1];
      const first = ss.find((q) => last && last.t - q.t <= 100) ?? ss[0];
      const dt = last && first ? (last.t - first.t) / 1000 : 0;
      if (last && first && dt > 0.008 && e.timeStamp - last.t < 80) {
        const vh = window.innerHeight || 1;
        const cap = 4; // viewport heights per second
        const vx = -((last.x - first.x) / vh) / dt;
        const vy = e.pointerType === "touch" ? 0 : (last.y - first.y) / vh / dt;
        drag.current.vx = Math.max(-cap, Math.min(cap, vx));
        drag.current.vy = Math.max(-cap, Math.min(cap, vy));
        drag.current.releaseId += 1;
      }
    }
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
    let seen = phaseRef.current;
    const tick = () => {
      // Only when it actually changes — a setState every frame, even one
      // that bails out, is work React does sixty times a second for nothing.
      if (phaseRef.current !== seen) {
        seen = phaseRef.current;
        setPhase(seen);
      }
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

  // ── Scroll lock while a photo is open ──
  // The page stays exactly where it is until the photo is closed: Lenis is
  // stopped (wheel, trackpad, keys), the document cannot overflow, and the
  // overlay itself takes no touch gestures (touch-action: none on it), which
  // is what holds a phone still — there is no Lenis on touch.
  useEffect(() => {
    if (expanded === null) return;
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    window.dispatchEvent(new Event("app:scroll-lock"));
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
      window.dispatchEvent(new Event("app:scroll-unlock"));
    };
  }, [expanded]);

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

  // Leaving the section closes the open photo. The lightbox is fixed to the
  // viewport and nothing locks the page under it, so scrolling while it was
  // open carried it over every section below and back — the photo "stuck
  // open". Nobody is watching by then, so it goes at once: no trail, no wipe.
  useEffect(() => {
    if (visible || expanded === null) return;
    const raf = requestAnimationFrame(() => {
      trail.stop();
      freezeGrid.current = false;
      setLightboxShown(false);
      setExpanded(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [visible, expanded, trail]);

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
  const showEnterHint = CLICK_ENTRY && phase === "globe";
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
        className={`absolute inset-0 ${CLICK_ENTRY ? "cursor-pointer" : ""}`}
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
          /* "demand", not "never", while the section is off screen.
             react-three-fiber renders once on mount under demand and then
             only when invalidated, which is exactly what is wanted here: the
             FIRST frame is the one that compiles every shader and uploads
             every texture, and under "never" that frame was deferred until
             the reader arrived — so it was paid at the worst possible moment.
             One frame off screen costs nothing and leaves nothing to pay. */
          frameloop={visible ? "always" : "demand"}
          camera={{ position: [0, 0, 17], fov: FOV_GLOBE, near: 0.1, far: 100 }}
          dpr={[1, sceneDprCap()]}
          onPointerMissed={() => {
            // A click that misses a photo (a gap) still advances the ENTRY —
            // unless it was a drag through the empty space between marks. With
            // the grid archived it advances nothing further: inside the field,
            // a miss is just a miss, and only a mark itself opens.
            if (didDrag.current) return;
            if (!CLICK_ENTRY) return;
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
        {showInsideHint
          ? "Drag to explore · Click a photo to open it"
          : "Click the world to enter"}
      </div>

      {/* Expand-to-centre lightbox — photo grows to the middle with its title
          and date to the side (like the Careers page). */}
      {/* Portaled to <body>: rendered inside the section, the overlay's
          `fixed` was only as fixed as the section let it be — any filter or
          transform on an ancestor (the click ripple puts a filter on the
          section for a second on every click) makes that ancestor its
          containing block, and the whole overlay slid down by the section's
          offset with a strip of page showing above it. */}
      {img && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-6"
          // No touch gesture that starts on the overlay can scroll the page
          // under it (see the scroll lock above).
          style={{ touchAction: "none", overscrollBehavior: "contain" }}
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
            className="liquid-glass lg-drop lg-gulp absolute top-[calc(var(--safe-top)+1rem)] right-[calc(var(--safe-right)+0.75rem)] z-[2] flex h-14 w-14 items-center justify-center rounded-[10px] text-white/80 hover:text-white md:top-[calc(var(--safe-top)+1.5rem)] md:right-[calc(var(--safe-right)+1.25rem)] md:h-16 md:w-16"
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
        </div>,
        document.body,
      )}
    </section>
  );
}
