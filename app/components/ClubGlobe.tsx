"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import {
  Canvas,
  useFrame,
  useLoader,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import UnicornBackground from "./UnicornBackground";
import ContactFooter from "./ContactFooter";

// Dev-only console logging — open DevTools on /club to watch the phases.
const DEBUG = process.env.NODE_ENV !== "production";
function logDebug(...args: unknown[]) {
  if (DEBUG) console.log("[ClubGlobe]", ...args);
}

// ── Layout ──────────────────────────────────────────────────────────────────
// Photos sit on a dense lat/long grid over a sphere (SCOLS around, SROWS
// top→bottom) — enough of them that, from the centre, the forward field of
// view is filled with a curved grid of photos (the "inside" look). The FLAT
// grid uses its own, narrower column count so it reads as a normal wall of
// photos rather than an ultra-wide strip.
const SCOLS = 18; // sphere columns (longitude)
const SROWS = 14; // sphere rows (latitude)
const TILE_COUNT = SCOLS * SROWS; // 252
const GRID_COLS = 9; // flat-grid columns (TILE_COUNT must divide by this)
const GRID_ROWS = TILE_COUNT / GRID_COLS; // 28
const SPHERE_R = 6; // globe radius
const PHOTO_INSET = 0.82; // photo size inside its white frame (frame = 1)

// ── Camera / timeline ───────────────────────────────────────────────────────
// Camera is LOCKED looking down -z; only its z (dolly) and fov are scripted.
//   approach: CAM_FAR → CAM_CENTER, fov widening — fly from outside INTO the
//             middle of the globe; you end surrounded by a curved wall of photos
//   inside:   hold at centre, sphere spinning, WAIT FOR A CLICK
//   unwrap:   on click, the sphere flattens into a grid (a ripple spreading
//             from the clicked photo) while the camera pulls back to frame it
//   grid:     columns scroll forever in alternating directions
const FOV_GLOBE = 40; // whole globe framed from outside
const FOV_INSIDE = 62; // wide, curved view from the centre
const FOV_GRID = 45; // frames the flat grid
const CAM_FAR = 18;
const CAM_CENTER = 0.05; // ~sphere centre (not exactly 0 so lookAt is stable)
const CAM_GRID = 7;
const APPROACH_DUR = 4.4; // seconds, far → centre
const UNWRAP_DUR = 2.4; // seconds, camera pull-back on click
const UNWRAP_RISE = 0.9; // per-tile flatten duration
const STAGGER_ANG = 0.28; // per-tile delay by sphere-angle from the click
const SPIN_SPEED = 0.16; // rad/s globe rotation
const SCROLL_SPEED = 0.7; // grid column scroll, world units / s
const GRID_GAP = 0.16; // gap as a fraction of the grid pitch
const VISIBLE_COLS = 6.4; // roughly how many columns fill the width
// Even columns (incl. both edges) rise, inner columns fall — left/right up,
// middle down. Flip the sign to reverse.
const columnDir = (col: number) => (col % 2 === 0 ? 1 : -1);

/**
 * ⚠️ PLACEHOLDER images — swap for the real club photos. Picsum seeds give
 * stable, varied placeholders that always load. They're framed square, so any
 * aspect works.
 */
const IMAGE_URLS = Array.from(
  { length: 24 },
  (_, i) => `https://picsum.photos/seed/zc-club-${i + 1}/600/600`,
);

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Centered wrap: fold v into [-period/2, period/2) so a column loops forever. */
const wrap = (v: number, period: number) =>
  THREE.MathUtils.euclideanModulo(v + period / 2, period) - period / 2;

// Scratch objects reused every frame (avoid per-frame allocation).
const _spin = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _sphereQuat = new THREE.Quaternion();
const _spherePos = new THREE.Vector3();
const _gridPos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _up = new THREE.Vector3(0, 0, 1);
const _IDENTITY_QUAT = new THREE.Quaternion();

interface TileData {
  gridCol: number;
  gridRow: number;
  dir: number;
  sphereDir: THREE.Vector3; // unit vector — home on the globe
  sphereBaseQuat: THREE.Quaternion; // orients the tile flat against the globe
  texIndex: number;
}

// ── Scene — loads textures, lays out tiles, drives the whole timeline ────────
function Scene({
  instant,
  active,
  unwrapRequest,
  clickedTile,
}: {
  instant: boolean;
  active: boolean;
  unwrapRequest: RefObject<boolean>;
  clickedTile: RefObject<number>;
}) {
  const size = useThree((s) => s.size);
  const textures = useLoader(THREE.TextureLoader, IMAGE_URLS);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const start = useRef(-1);
  const scroll = useRef(0);
  const phase = useRef("");
  const unwrapStart = useRef(-1);

  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // Static per-tile data: a lat/long home on the sphere + a cell in the flat
  // grid (the two layouts are independent).
  const tiles = useMemo<TileData[]>(() => {
    return Array.from({ length: TILE_COUNT }, (_, i) => {
      const scol = i % SCOLS;
      const srow = Math.floor(i / SCOLS);
      const phi = ((srow + 0.5) / SROWS) * Math.PI; // 0 (top) … π (bottom)
      const theta = (scol / SCOLS) * Math.PI * 2; // around
      const sphereDir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );
      const sphereBaseQuat = new THREE.Quaternion().setFromUnitVectors(
        _up,
        sphereDir,
      );
      const gridCol = i % GRID_COLS;
      const gridRow = Math.floor(i / GRID_COLS);
      return {
        gridCol,
        gridRow,
        dir: columnDir(gridCol),
        sphereDir,
        sphereBaseQuat,
        texIndex: i % textures.length,
      };
    });
  }, [textures.length]);

  // Grid metrics, recomputed on resize so the flat grid fills the viewport.
  const grid = useMemo(() => {
    const aspect = size.width / size.height;
    const halfH = Math.tan((FOV_GRID * Math.PI) / 360) * CAM_GRID;
    const viewW = 2 * halfH * aspect;
    const pitch = viewW / VISIBLE_COLS;
    const tileWorld = pitch * (1 - GRID_GAP);
    const period = GRID_ROWS * pitch; // one column's wrap length
    const baseX = (col: number) => (col - (GRID_COLS - 1) / 2) * pitch;
    const baseY = (row: number) => (row - (GRID_ROWS - 1) / 2) * pitch;
    // Sphere tile size — a bit under the lat/long spacing so frames don't
    // collide, leaving the gaps seen in the reference.
    const sphereTile =
      Math.min((2 * Math.PI * SPHERE_R) / SCOLS, (Math.PI * SPHERE_R) / SROWS) *
      0.62;
    return { pitch, tileWorld, period, baseX, baseY, sphereTile };
  }, [size.width, size.height]);

  useFrame((state, rawDt) => {
    const camera = state.camera as THREE.PerspectiveCamera; // frame state, not a hook
    const dt = Math.min(rawDt, 1 / 30);
    const clock = state.clock.elapsedTime;

    const running = activeRef.current || instant;
    if (running && start.current < 0) {
      start.current = clock;
      logDebug(
        `intro started — ${TILE_COUNT} tiles (${SCOLS}×${SROWS} sphere, ${GRID_COLS}×${GRID_ROWS} grid), ${textures.length} textures | ${instant ? "reduced-motion: jump to grid" : "approach → inside → (click) unwrap → grid"}`,
      );
    }
    const elapsed = !running ? 0 : clock - start.current;

    // ── Timeline scalars ──────────────────────────────────────────────────
    const approach = instant
      ? 1
      : easeInOut(THREE.MathUtils.clamp(elapsed / APPROACH_DUR, 0, 1));

    // Accept a queued click once we've basically arrived inside.
    if (
      (instant || (unwrapRequest.current && approach > 0.9)) &&
      unwrapStart.current < 0
    ) {
      unwrapStart.current = elapsed;
      if (!instant)
        logDebug(
          `click → unwrapping to grid (ripple from tile ${clickedTile.current})`,
        );
    }
    const unwrapElapsed =
      unwrapStart.current < 0 ? 0 : elapsed - unwrapStart.current;
    const unwrap = instant
      ? 1
      : easeInOut(THREE.MathUtils.clamp(unwrapElapsed / UNWRAP_DUR, 0, 1));

    // Globe spins off the wall clock (continuous through the reveal) and eases
    // to a stop as it unwraps.
    const spin = clock * SPIN_SPEED * (1 - unwrap);
    _spin.setFromAxisAngle(_yAxis, spin);

    // Camera: far → centre during approach, then centre → grid on unwrap; fov
    // widens going in for the curved "inside" look, then tightens for the grid.
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

    // Grid columns scroll once the unwrap is essentially done.
    const scrollGate = THREE.MathUtils.clamp((unwrap - 0.7) / 0.3, 0, 1);
    scroll.current += dt * SCROLL_SPEED * scrollGate;

    const clickDir = tiles[clickedTile.current]?.sphereDir;

    for (let i = 0; i < tiles.length; i++) {
      const g = groups.current[i];
      if (!g) continue;
      const tile = tiles[i];

      // Per-tile flatten, rippling out from the clicked photo across the
      // sphere (so the wave you see emanates from where you clicked).
      const angle = clickDir ? clickDir.angleTo(tile.sphereDir) : 0;
      const m =
        unwrapStart.current < 0
          ? 0
          : easeInOut(
              THREE.MathUtils.clamp(
                (unwrapElapsed - angle * STAGGER_ANG) / UNWRAP_RISE,
                0,
                1,
              ),
            );

      // Sphere pose (spun around Y).
      _spherePos
        .copy(tile.sphereDir)
        .applyQuaternion(_spin)
        .multiplyScalar(SPHERE_R);
      _sphereQuat.multiplyQuaternions(_spin, tile.sphereBaseQuat);

      // Grid pose (this column's scroll, wrapped so it loops).
      const y = wrap(
        grid.baseY(tile.gridRow) + tile.dir * scroll.current,
        grid.period,
      );
      _gridPos.set(grid.baseX(tile.gridCol), y, 0);

      g.position.lerpVectors(_spherePos, _gridPos, m);
      g.quaternion.slerpQuaternions(_sphereQuat, _IDENTITY_QUAT, m);
      const s = THREE.MathUtils.lerp(grid.sphereTile, grid.tileWorld, m);
      _scale.set(s, s, s);
      g.scale.copy(_scale);
    }

    if (DEBUG) {
      const p =
        unwrapStart.current >= 0
          ? unwrap < 1
            ? "unwrap"
            : "grid"
          : approach < 1
            ? "approach"
            : "inside (awaiting click)";
      if (p !== phase.current) {
        phase.current = p;
        logDebug(
          `phase → ${p} | t=${elapsed.toFixed(2)}s cam.z=${camZ.toFixed(2)} fov=${fov.toFixed(0)} approach=${approach.toFixed(2)} unwrap=${unwrap.toFixed(2)}`,
        );
      }
    }
  });

  const onTileClick = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (unwrapRequest.current) return;
    unwrapRequest.current = true;
    clickedTile.current = i;
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
          {/* White frame. */}
          <mesh renderOrder={0}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              color="#ffffff"
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
          {/* Photo, inset in the frame. polygonOffset keeps it drawn on top of
              the frame from either side without z-fighting. */}
          <mesh renderOrder={1}>
            <planeGeometry args={[PHOTO_INSET, PHOTO_INSET]} />
            <meshBasicMaterial
              map={textures[tile.texIndex]}
              map-colorSpace={THREE.SRGBColorSpace}
              map-anisotropy={8}
              side={THREE.DoubleSide}
              toneMapped={false}
              polygonOffset
              polygonOffsetFactor={-1}
              polygonOffsetUnits={-1}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

export default function ClubGlobe() {
  const { prefersReducedMotion } = useDeviceDetect();
  // Click intent, lifted here so a click that misses a photo (a gap) still
  // triggers the unwrap via the Canvas's onPointerMissed.
  const unwrapRequest = useRef(false);
  const clickedTile = useRef(Math.floor(TILE_COUNT / 2));

  // Start the intro when the site's loading screen finishes (template.tsx
  // fires `app:reveal` and sets `__appRevealed`).
  const [active, setActive] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean((window as Window & { __appRevealed?: boolean }).__appRevealed),
  );
  useEffect(() => {
    if (active) return;
    const onReveal = () => setActive(true);
    window.addEventListener("app:reveal", onReveal);
    const fallback = window.setTimeout(() => setActive(true), 2600);
    return () => {
      window.removeEventListener("app:reveal", onReveal);
      window.clearTimeout(fallback);
    };
  }, [active]);

  return (
    <>
      {/* Shared Unicorn Studio WebGL background — same fixed scene as the main
          page (z -10); the transparent canvas below lets it show through. */}
      <UnicornBackground />
      <main className="relative w-full max-w-full overflow-x-hidden">
        <div className="relative h-dvh w-full cursor-pointer overflow-hidden">
          <h1 className="sr-only">The Club — Zuhayr Creative</h1>
          <Canvas
            className="absolute inset-0"
            camera={{ position: [0, 0, CAM_FAR], fov: FOV_GLOBE, near: 0.1, far: 100 }}
            dpr={[1, 2]}
            onPointerMissed={() => {
              unwrapRequest.current = true; // click in a gap still unwraps
            }}
          >
            {/* No scene background — the canvas stays transparent so the Unicorn
                background shows through. */}
            <Suspense fallback={null}>
              <Scene
                instant={prefersReducedMotion}
                active={active}
                unwrapRequest={unwrapRequest}
                clickedTile={clickedTile}
              />
            </Suspense>
          </Canvas>
        </div>

        {/* Site footer, same as the main page. */}
        <ContactFooter />
      </main>
    </>
  );
}
