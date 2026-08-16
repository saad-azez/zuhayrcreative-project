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
import { useImageTrail, TRAIL_HIDDEN_CLIP } from "@/app/animations/useImageTrail";
import type { TrailRect } from "@/app/animations/repeatingImageTransition";

// Dev-only console logging — open DevTools and scroll to #seasons to watch the
// phases (globe → approach → inside → unwrap → grid).
const DEBUG = false;
function logDebug(...args: unknown[]) {
  if (DEBUG) console.log("[SeasonsGlobe]", ...args);
}

// ── Layout ──────────────────────────────────────────────────────────────────
const SCOLS = 18; // sphere columns (longitude)
const SROWS = 14; // sphere rows (latitude)
const TILE_COUNT = SCOLS * SROWS; // 252
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

// ── Camera / timeline ───────────────────────────────────────────────────────
const FOV_GLOBE = 40; // whole globe framed from outside
const FOV_INSIDE = 62; // wide, curved view from the centre
const FOV_GRID = 45; // frames the flat grid
// Framing distance for the globe. The sphere spans ±SPHERE_R, so its on-screen
// height is SPHERE_R / (tan(FOV_GLOBE/2) * CAM_FAR) of the half-viewport — at
// 18 that was 92%, leaving the globe filling the frame top to bottom with no
// room for the hint line, which then had to sit on top of the busiest band of
// tiles. Pulling back to 20 drops it to ~82% and opens a clear strip beneath.
const CAM_FAR = 20;
const CAM_CENTER = 0.05; // ~sphere centre (not exactly 0 so lookAt is stable)
const CAM_GRID = 7;
const APPROACH_DUR = 4.4; // seconds, far → centre (after the entry click)
const UNWRAP_DUR = 2.4; // seconds, camera pull-back on the image click
const UNWRAP_RISE = 0.9; // per-tile flatten duration
const STAGGER_ANG = 0.28; // per-tile delay by sphere-angle from the click
const SPIN_SPEED = 0.16; // rad/s globe rotation
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
// When the sphere opens out into the field, as a fraction of the approach.
//
// Held this late on purpose. The fly-in is meant to read as the camera moving
// and NOTHING else: marks drifting out of the shell and settling into the field
// partway through looks like a second rearrange, and pre-empts the only one
// that should register — the unwrap into the grid.
//
// The camera crosses the shell (camZ = SPHERE_R) at approach ≈ 0.7, so opening
// at 0.82 means the spread happens entirely from INSIDE: the marks move outward
// past the camera, which reads as depth opening up rather than as scattering.
// `approach` is itself eased, so this is still ~1.5s of the 4.4s fly-in, not a
// burst — the last 15% of the curve is the slow part.
const FIELD_OPEN_FROM = 0.82;
const STAGGER_FIELD = 0.055; // unwrap delay per world unit from the clicked tile

// Drag. Pointer only — the wheel is deliberately left alone so the page still
// scrolls past this section under the shared Locomotive provider.
const DRAG_DAMPING = 0.1;
const DRAG_THRESHOLD = 6; // px of travel before a press counts as a drag
const DRAG_SENSITIVITY = 0.035; // px → world units

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
const _sphereQuat = new THREE.Quaternion();
const _spherePos = new THREE.Vector3();
const _gridPos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _IDENTITY_QUAT = new THREE.Quaternion();
const _fieldPos = new THREE.Vector3();
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
      const scol = i % SCOLS;
      const srow = Math.floor(i / SCOLS);
      const phi = ((srow + 0.5) / SROWS) * Math.PI;
      const theta = (scol / SCOLS) * Math.PI * 2;
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

  const grid = useMemo(() => {
    const aspect = size.width / size.height;
    const halfH = Math.tan((FOV_GRID * Math.PI) / 360) * CAM_GRID;
    const viewW = 2 * halfH * aspect;
    const pitch = viewW / VISIBLE_COLS;
    const tileWorld = pitch * (1 - GRID_GAP);
    const period = GRID_ROWS * pitch;
    const baseX = (col: number) => (col - (GRID_COLS - 1) / 2) * pitch;
    const baseY = (row: number) => (row - (GRID_ROWS - 1) / 2) * pitch;
    const sphereTile =
      Math.min((2 * Math.PI * SPHERE_R) / SCOLS, (Math.PI * SPHERE_R) / SROWS) *
      0.62;
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

    // The approach only begins once the globe has been clicked (or reduced
    // motion jumps straight in). Until then the globe just sits and spins.
    const running = expandRequest.current || instant;
    if (running && start.current < 0) {
      start.current = clock;
      logDebug(
        `entry click → approach begins (${TILE_COUNT} tiles, ${textures.length} textures)`,
      );
    }
    const elapsed = !running ? 0 : clock - start.current;

    const approach = instant
      ? 1
      : easeInOut(THREE.MathUtils.clamp(elapsed / APPROACH_DUR, 0, 1));

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
    _spin.setFromAxisAngle(_yAxis, spinAngle.current);

    const camZ =
      unwrapStart.current < 0
        ? THREE.MathUtils.lerp(CAM_FAR, CAM_CENTER, approach)
        : THREE.MathUtils.lerp(CAM_CENTER, CAM_GRID, unwrap);
    const fov =
      unwrapStart.current < 0
        ? THREE.MathUtils.lerp(FOV_GLOBE, FOV_INSIDE, approach)
        : THREE.MathUtils.lerp(FOV_INSIDE, FOV_GRID, unwrap);
    camera.position.set(0, 0, camZ);
    camera.lookAt(0, 0, 0);
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

    // How far the sphere has opened out into the field. Freezes at the moment
    // the unwrap begins — from there the tiles are flying to the grid, and a
    // field still resolving underneath them would drag the "from" position out
    // from under the flight.
    const fieldBlend = instant
      ? 0
      : easeInOut(
          THREE.MathUtils.clamp(
            (approach - FIELD_OPEN_FROM) / (1 - FIELD_OPEN_FROM),
            0,
            1,
          ),
        );

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
        .multiplyScalar(SPHERE_R);
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
        grid.sphereTile,
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
    // tile would also unwrap the field into the grid.
    if (didDrag.current) return;
    // Grid is up → clicking a photo expands it to the centre.
    if (instant || gridReady.current) {
      // Remember WHICH tile, not where it was: the trail projects this tile's
      // live position whenever it needs it, and the grid never stops scrolling.
      clickedTile.current = i;
      onImageOpen(tiles[i].texIndex);
      return;
    }
    // First click → fly into the globe. Second (inside) → unwrap to the grid.
    if (!expandRequest.current) {
      expandRequest.current = true;
      return;
    }
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
 * Flow: the globe sits and spins → click it to fly INSIDE → click a photo to
 * unwrap into the scrolling grid → click any grid photo to expand it to the
 * centre with its title/date.
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
    // Hold the grid from this instant until the closing trail has landed, so
    // the tile the clones fly from and back to is exactly where it was left.
    freezeGrid.current = true;
    // Still a getter rather than a box: the grid is frozen, but the section can
    // be resized or scrolled while the image is open, either of which moves the
    // tile on screen without the grid itself advancing.
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
          camera={{ position: [0, 0, CAM_FAR], fov: FOV_GLOBE, near: 0.1, far: 100 }}
          dpr={[1, 2]}
          onPointerMissed={() => {
            // A click that misses a photo (a gap) still advances the flow —
            // unless it was a drag through the empty space between marks.
            if (didDrag.current) return;
            if (prefersReducedMotion || phaseRef.current === "grid") return;
            if (!expandRequest.current) expandRequest.current = true;
            else if (!unwrapRequest.current) unwrapRequest.current = true;
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
          edge sits at a fixed fraction of the section height (it depends only
          on FOV_GLOBE and CAM_FAR, not on the viewport), so a fixed offset
          holds the line below it at every size — hence a vh offset, dropped to
          2vh so the line sits clear of the tiles rather than tucked under
          them. safe-bottom keeps it off the home indicator on phones. */}
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
          ? "Drag to explore · Click a photo to open the grid"
          : "Click the world to enter"}
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
            className="absolute top-[calc(var(--safe-top)+1rem)] right-[calc(var(--safe-right)+0.75rem)] z-[2] flex h-14 w-14 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.05] text-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-md transition duration-200 hover:bg-white/10 hover:text-white active:scale-95 md:top-[calc(var(--safe-top)+1.5rem)] md:right-[calc(var(--safe-right)+1.25rem)] md:h-16 md:w-16"
          >
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
