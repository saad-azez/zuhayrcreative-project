"use client";

import {
  Suspense,
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

type Phase = "globe" | "approach" | "inside" | "unwrap" | "grid";

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
  { src: "/AI-10.png", title: "Hong Kong", date: "Bauhinia" },
  { src: "/AI-12.png", title: "Lunar", date: "Year of the Dragon" },
  { src: "/AI-14.png", title: "Singapore", date: "Marina Bay" },
];

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
const _IDENTITY_QUAT = new THREE.Quaternion();

interface TileData {
  gridCol: number;
  gridRow: number;
  dir: number;
  sphereDir: THREE.Vector3;
  sphereBaseQuat: THREE.Quaternion;
  texIndex: number;
}

// ── Scene — loads textures, lays out tiles, drives the whole timeline ────────
function Scene({
  instant,
  expandRequest,
  unwrapRequest,
  clickedTile,
  phaseRef,
  onImageOpen,
}: {
  instant: boolean;
  expandRequest: RefObject<boolean>; // first click → fly INTO the globe
  unwrapRequest: RefObject<boolean>; // click inside → unwrap to the grid
  clickedTile: RefObject<number>;
  phaseRef: RefObject<Phase>; // written each frame; the section polls it for UI
  onImageOpen: (texIndex: number) => void; // grid click → expand to centre
}) {
  const size = useThree((s) => s.size);
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
      };
    });
  }, [textures.length]);

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

    // Grid columns scroll once the unwrap is essentially done. This keeps
    // running while an image is expanded — the lightbox sits over a live grid
    // rather than a frozen still, which is what made the whole section look
    // like it had hung on open.
    const scrollGate = THREE.MathUtils.clamp((unwrap - 0.7) / 0.3, 0, 1);
    scroll.current += dt * SCROLL_SPEED * scrollGate;
    if (unwrap >= 1) gridReady.current = true;

    const clickDir = tiles[clickedTile.current]?.sphereDir;

    for (let i = 0; i < tiles.length; i++) {
      const g = groups.current[i];
      if (!g) continue;
      const tile = tiles[i];

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

      _spherePos
        .copy(tile.sphereDir)
        .applyQuaternion(_spin)
        .multiplyScalar(SPHERE_R);
      _sphereQuat.multiplyQuaternions(_spin, tile.sphereBaseQuat);

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
    // Grid is up → clicking a photo expands it to the centre.
    if (instant || gridReady.current) {
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

  // Cursor splash — ONLY on the expanded photo, same as the Careers lightbox.
  // The globe itself is WebGL, so there is no DOM <img> to attach to until a
  // tile is opened; gating on `expanded` also means no GL context is created
  // until then. The host is the wrapper immediately around the <img> so the
  // canvas lands in the same box, and inherits the same rounding and shadow.
  const splashRef = useRef<HTMLDivElement>(null);
  useSplashHover(splashRef, expanded !== null);

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

  const openImage = (texIndex: number) => setExpanded(texIndex);
  const closeImage = () => {
    setLightboxShown(false);
    window.setTimeout(() => setExpanded(null), 320);
  };

  useEffect(() => {
    if (expanded === null) return;
    const raf = requestAnimationFrame(() => setLightboxShown(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxShown(false);
        window.setTimeout(() => setExpanded(null), 320);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

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
      <div className="absolute inset-0 cursor-pointer">
        <Canvas
          className="absolute inset-0"
          frameloop={visible ? "always" : "never"}
          camera={{ position: [0, 0, CAM_FAR], fov: FOV_GLOBE, near: 0.1, far: 100 }}
          dpr={[1, 2]}
          onPointerMissed={() => {
            // A click that misses a photo (a gap) still advances the flow.
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
        className={`pointer-events-none absolute bottom-[calc(var(--safe-bottom,0px)+2vh)] left-1/2 -translate-x-1/2 flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.3em] text-white/75 transition-opacity duration-500 ${showEnterHint || showInsideHint ? "opacity-100" : "opacity-0"}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#c4010d]" />
        {showInsideHint ? "Click a photo to open the grid" : "Click the world to enter"}
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
            className={`relative z-[1] flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${lightboxShown ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-90 opacity-0"}`}
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
                src={img.src}
                alt={img.title}
                className="block max-h-[64vh] w-auto object-cover"
              />
            </div>
            <figcaption className="flex flex-col items-center text-center sm:items-start sm:text-left">
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
