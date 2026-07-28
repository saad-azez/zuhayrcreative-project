"use client";

import {
  Suspense,
  useEffect,
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
import UnicornBackground from "./UnicornBackground";

// Dev-only console logging — open DevTools on /career to see what the scene
// is doing: camera setup, where each slot actually lands on screen, texture
// loads, hover and drag events.
const DEBUG = false;

function logDebug(...args: unknown[]) {
  if (DEBUG) console.log("[CareerGallery]", ...args);
}

// ── Scene geometry ──────────────────────────────────────────────────────────
// Values extracted from the live reference site's three.js scene graph (via
// the __THREE_DEVTOOLS__ hook): an extreme-telephoto camera (fov 5°) sits
// high and far at (0, 13.33, 35), pitched down -0.364 rad, looking at a row
// of thin glass slabs at y=0 that march along a straight x/z line. The
// telephoto compression gives the near-isometric look; the pitched camera
// makes "farther away" project as "higher on screen", which creates the
// bottom-left → top-right diagonal. The camera is LOCKED — no orbit; all
// motion is the tiles sliding along their line.
const CAM_POS: [number, number, number] = [0, 13.3333, 35];
const CAM_PITCH = -0.364; // rad, straight from the reference camera
const FOV = 5;
const ROT_Y = -Math.PI / 6; // panel yaw -30°, from the reference tiles
// Hover slides the tile to screen-right — world +x maps exactly to screen
// right under this pitch-only camera. Depth is unchanged, so the tile stays
// in front of its farther neighbor while it slides out of the deck.
const HOVER_SHIFT = new THREE.Vector3(1, 0, 0);
const LIFT = 0.6; // hover slide distance ≈ half a panel width
const BASE_OPACITY = 0.92;
const INTRO_FROM = new THREE.Vector3(0.75, 0, -2.5); // settle in from up the line
// Pointer travel (px) that turns a press into a drag rather than a click.
const DRAG_THRESHOLD_PX = 5;

// Wheel / trackpad scrub sensitivity (tile units per wheel pixel). The belt
// only moves on a deliberate input — drag or wheel; it never drifts on its own.
const WHEEL_FACTOR = 0.0016;

// ── The line the tiles ride ─────────────────────────────────────────────────
// Reference step direction (+0.375, 0, -1) scaled ×2.667 so each step is one
// "tile unit" that spans a fifth of the screen diagonal.
const STEP = new THREE.Vector3(1, 0, -2.667);
// 10 slots ride the line; the 5 images cycle through them (slot k shows image
// k mod 5). Slots live on t ∈ [-5, 5) tile units and wrap around — the wrap
// points are far off-screen, so the belt looks infinite. The slot count is a
// multiple of the image count so each image's two copies always stay exactly
// 5 tile units apart (≈ a full screen) — duplicates never bunch up after a
// wrap.
const SLOT_COUNT = 10;
const PERIOD = 10;
const slotOffset = (k: number) => k - (SLOT_COUNT - 1) / 2; // -3 … +3
const wrapT = (t: number) =>
  THREE.MathUtils.euclideanModulo(t + PERIOD / 2, PERIOD) - PERIOD / 2;
// Screen-space direction of one +1 tile step, as fractions of viewport
// width/height (measured from the projected layout): right and UP.
const STEP_SCREEN: [number, number] = [0.175, -0.315];

// The reference's exact tile size (4:5 portrait) and slab thickness.
const PANEL_SIZE: [number, number] = [1.3125, 1.6406];
const PANEL_DEPTH = 0.0175;

/**
 * ⚠️ PLACEHOLDER roles + images — swap `src`/`alt`/`meta`/`year` for real
 * openings and artwork (keep images 4:5-ish portrait so nothing stretches).
 * Each entry is ONE role: it owns a picture on the belt AND a row in the
 * index list, and the two are linked — hovering either highlights the pair
 * and slides the picture out to the right.
 */
interface PanelDef {
  src: string;
  alt: string;
  meta: string;
  year: string;
}

const PANELS: PanelDef[] = [
  { src: "https://picsum.photos/seed/zc-career-01/800/1000", alt: "Creative Direction", meta: "Art & Design", year: "2026" },
  { src: "https://picsum.photos/seed/zc-career-02/800/1000", alt: "Motion Design", meta: "3D & Animation", year: "2026" },
  { src: "https://picsum.photos/seed/zc-career-03/800/1000", alt: "Web Engineering", meta: "Development", year: "2026" },
  { src: "https://picsum.photos/seed/zc-career-04/800/1000", alt: "Brand Strategy", meta: "Strategy", year: "2025" },
  { src: "https://picsum.photos/seed/zc-career-05/800/1000", alt: "AI Automation", meta: "Technology", year: "2026" },
];

/**
 * Mutable scroll/drag state shared between the DOM pointer handlers and the
 * R3F frame loop. Dragging turns pointer movement into ONE scalar — progress
 * along the line, in tile units — like rotating a knob. The camera never
 * moves.
 */
interface ScrollState {
  active: boolean; // pointer is down (drag pending or in progress)
  captured: boolean; // pointer moved past the click threshold — real drag
  target: number; // where the knob has been turned to (tile units)
  current: number; // damped value the tiles actually render at
  velocity: number; // tile units / s, for flywheel inertia on release
  downX: number;
  downY: number;
  lastX: number;
  lastY: number;
  lastT: number;
}

/** Project a pointer delta (px) onto the line's screen direction → tile units. */
function pointerToTiles(dx: number, dy: number, width: number, height: number) {
  const sx = STEP_SCREEN[0] * width;
  const sy = STEP_SCREEN[1] * height;
  return (dx * sx + dy * sy) / (sx * sx + sy * sy);
}

// ── LayoutLogger — dev-only: prints where every slot actually lands ─────────
// Projects each slot's center and edges through the live camera and logs a
// table: tile unit, world position, screen x/y (%), left/right edge (%), and
// how much each slot overlaps the previous one on screen.
function LayoutLogger() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  // Log once per viewport size — not on every unrelated re-render.
  const loggedFor = useRef("");

  useEffect(() => {
    if (!DEBUG) return;
    const key = `${size.width}x${size.height}`;
    if (loggedFor.current === key) return;
    loggedFor.current = key;
    camera.updateMatrixWorld();
    const toScreen = (world: THREE.Vector3) => {
      const ndc = world.clone().project(camera);
      return { fx: (ndc.x + 1) / 2, fy: (1 - ndc.y) / 2 };
    };
    // Half-extent of a panel along its own width, in world space (shared yaw).
    const widthDir = new THREE.Vector3(Math.cos(ROT_Y), 0, -Math.sin(ROT_Y));

    logDebug(
      `camera: pos (${CAM_POS.join(",")}) pitch ${CAM_PITCH} rad, fov ${FOV}° (reference-exact telephoto, LOCKED) | panel yaw ${ROT_Y.toFixed(4)} rad (${((ROT_Y * 180) / Math.PI).toFixed(1)}°) | viewport ${size.width}×${size.height}px`,
    );
    let prevRight: number | null = null;
    const rows = Array.from({ length: SLOT_COUNT }, (_, k) => {
      const t = slotOffset(k);
      const center = STEP.clone().multiplyScalar(t);
      const c = toScreen(center);
      const left = toScreen(
        center.clone().addScaledVector(widthDir, -PANEL_SIZE[0] / 2),
      );
      const right = toScreen(
        center.clone().addScaledVector(widthDir, PANEL_SIZE[0] / 2),
      );
      const overlap =
        prevRight === null ? "—" : `${((prevRight - left.fx) * 100).toFixed(1)}%`;
      prevRight = right.fx;
      return {
        slot: `${k} → "${PANELS[k % PANELS.length].alt}"`,
        "tile t": t,
        "world (x,y,z)": STEP.clone()
          .multiplyScalar(t)
          .toArray()
          .map((n) => +n.toFixed(2))
          .join(", "),
        "screen x": `${(c.fx * 100).toFixed(1)}%`,
        "screen y": `${(c.fy * 100).toFixed(1)}%`,
        "left edge": `${(left.fx * 100).toFixed(1)}%`,
        "right edge": `${(right.fx * 100).toFixed(1)}%`,
        "overlap w/ prev": overlap,
      };
    });
    console.table(rows);
    logDebug(
      `slots wrap at t = ±${PERIOD / 2} tile units (both fully off-screen) — the belt is infinite; drag scroll shifts every t equally`,
    );
  }, [camera, size]);

  return null;
}

// ── Rig — drives the scroll physics and responsive scale ────────────────────
function Rig({
  scrollRef,
  children,
}: {
  scrollRef: RefObject<ScrollState>;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const viewport = useThree((s) => s.viewport);

  useFrame((_, rawDt) => {
    const g = group.current;
    const scroll = scrollRef.current;
    if (!g) return;
    const dt = Math.min(rawDt, 1 / 30); // clamp tab-switch spikes

    if (!scroll.active) {
      // Flywheel: after a drag/wheel the knob keeps turning, bleeding speed
      // exponentially — then the belt sits still until the next input. It never
      // drifts on its own.
      scroll.target += scroll.velocity * dt;
      scroll.velocity *= Math.exp(-2 * dt);
    }
    // Trail the knob slightly so the belt feels weighty.
    scroll.current = THREE.MathUtils.damp(scroll.current, scroll.target, 8, dt);

    // Shrink the whole scene on narrow viewports so the line stays in frame
    // (the visible chain spans ~5.8 world units of width at design aspect).
    const s = THREE.MathUtils.clamp(viewport.width / 5.8, 0.45, 1);
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, s, 6, dt));
  });

  return <group ref={group}>{children}</group>;
}

// ── One translucent image slab riding the line ──────────────────────────────
function Panel({
  data,
  slot,
  hovered,
  onEnter,
  onLeave,
  onSelect,
  scrollRef,
  instant,
}: {
  data: PanelDef;
  slot: number;
  hovered: boolean;
  onEnter: () => void; // pointer entered this slot — links to its role
  onLeave: () => void;
  onSelect: () => void; // click (not drag) → expand this image to centre
  scrollRef: RefObject<ScrollState>;
  instant: boolean; // prefers-reduced-motion — skip the intro/lift animation
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const texture = useLoader(THREE.TextureLoader, data.src);

  useEffect(() => {
    logDebug(
      `texture ready: "${data.alt}" (${texture.image?.width}×${texture.image?.height}px) — ${data.src}`,
    );
  }, [texture, data.alt, data.src]);

  const startT = useRef(-1); // clock time when this panel first rendered
  const liftCur = useRef(0);
  const opacityCur = useRef(0);

  useFrame((state, dt) => {
    const m = mesh.current;
    const material = mat.current;
    if (!m || !material) return;

    // Staggered settle-in from up the line, once, on first frame.
    if (startT.current < 0) startT.current = state.clock.elapsedTime;
    const t = instant
      ? 1
      : THREE.MathUtils.clamp(
          (state.clock.elapsedTime - startT.current - slot * 0.08) / 0.9,
          0,
          1,
        );
    const ease = 1 - Math.pow(1 - t, 3);

    liftCur.current = THREE.MathUtils.damp(
      liftCur.current,
      hovered ? LIFT : 0,
      instant ? 100 : 8,
      dt,
    );

    // Ride the belt: this slot's spot on the line, shifted by the shared
    // scroll and wrapped around the (off-screen) ends.
    const lineT = wrapT(slotOffset(slot) + scrollRef.current.current);
    m.position
      .copy(STEP)
      .multiplyScalar(lineT)
      .addScaledVector(HOVER_SHIFT, liftCur.current)
      .addScaledVector(INTRO_FROM, 1 - ease);

    opacityCur.current = THREE.MathUtils.damp(
      opacityCur.current,
      hovered ? 1 : BASE_OPACITY,
      8,
      dt,
    );
    material.opacity = ease * opacityCur.current;
  });

  return (
    <mesh
      ref={mesh}
      rotation={[0, ROT_Y, 0]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        // Only the front-most panel under the cursor should pop.
        e.stopPropagation();
        if (!scrollRef.current.captured) onEnter();
      }}
      onPointerOut={onLeave}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        // A press that never became a drag (see DRAG_THRESHOLD_PX) is a click:
        // expand this image to the centre. stopPropagation so only the
        // front-most panel opens.
        e.stopPropagation();
        if (!scrollRef.current.captured) onSelect();
      }}
    >
      {/* Thin box, not a plane — the reference tiles are 0.0175-thick glass
          slabs whose edges catch the eye at this angle. */}
      <boxGeometry args={[PANEL_SIZE[0], PANEL_SIZE[1], PANEL_DEPTH]} />
      {/* Dashed props: R3F applies the nested texture settings itself.
          Panels are viewed at a steep angle — anisotropy keeps them crisp
          (three clamps it to the device max). */}
      <meshBasicMaterial
        ref={mat}
        map={texture}
        map-colorSpace={THREE.SRGBColorSpace}
        map-anisotropy={16}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export default function CareerGallery() {
  // Hover is keyed by ROLE (0…4), so a picture and its list row light up
  // together. It has two independent sources — the belt (a picture) and the
  // list (a row) — merged so moving the cursor between a picture and its own
  // row never flickers the highlight off.
  const [fromBelt, setFromBelt] = useState<number | null>(null);
  const [fromList, setFromList] = useState<number | null>(null);
  const hoveredRole = fromBelt ?? fromList;
  const [grabbing, setGrabbing] = useState(false);
  // Which role's image is expanded to the centre (null = none). `shown` drives
  // the enter/exit transition so the image grows in and fades out.
  const [expandedRole, setExpandedRole] = useState<number | null>(null);
  const [lightboxShown, setLightboxShown] = useState(false);
  const { prefersReducedMotion } = useDeviceDetect();

  const enterRole = (role: number, src: "belt" | "list") =>
    (src === "belt" ? setFromBelt : setFromList)(role);
  // Clear only if this source still points at the role being left.
  const leaveRole = (role: number, src: "belt" | "list") =>
    (src === "belt" ? setFromBelt : setFromList)((cur) =>
      cur === role ? null : cur,
    );

  useEffect(() => {
    if (hoveredRole !== null) {
      logDebug(
        `hover: "${PANELS[hoveredRole].alt}" (role ${hoveredRole}, via ${fromBelt !== null ? "belt" : "list"}) — picture + row slide right by ${LIFT}`,
      );
    } else {
      logDebug("hover: none — all panels at rest opacity", BASE_OPACITY);
    }
  }, [hoveredRole, fromBelt]);

  const scrollRef = useRef<ScrollState>({
    active: false,
    captured: false,
    target: 0,
    current: 0,
    velocity: 0,
    downX: 0,
    downY: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
  });

  // Expand-to-centre lightbox: animate in on the next frame, animate out (then
  // unmount) on close / Escape. The belt freeze is derived from `expandedRole`
  // (passed to <Rig> and checked in the input handlers) — the effect never
  // touches scrollRef, which the React Compiler forbids inside effects.
  const closeLightbox = () => {
    setLightboxShown(false);
    window.setTimeout(() => setExpandedRole(null), 320);
  };

  useEffect(() => {
    if (expandedRole === null) return;
    const raf = requestAnimationFrame(() => setLightboxShown(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxShown(false);
        window.setTimeout(() => setExpandedRole(null), 320);
      }
    };
    window.addEventListener("keydown", onKey);
    logDebug(
      `expand: "${PANELS[expandedRole].alt}" (role ${expandedRole}) → centre lightbox`,
    );
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
  }, [expandedRole]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (expandedRole !== null) return;
    const scroll = scrollRef.current;
    scroll.active = true;
    scroll.captured = false;
    scroll.velocity = 0;
    scroll.downX = e.clientX;
    scroll.downY = e.clientY;
    scroll.lastX = e.clientX;
    scroll.lastY = e.clientY;
    scroll.lastT = e.timeStamp;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const scroll = scrollRef.current;
    if (!scroll.active) return;
    // Capturing the pointer retargets every later event to this wrapper,
    // which would swallow the canvas's own pointer events — so only capture
    // once the press has unambiguously become a drag.
    if (!scroll.captured) {
      const travel = Math.hypot(
        e.clientX - scroll.downX,
        e.clientY - scroll.downY,
      );
      if (travel < DRAG_THRESHOLD_PX) return;
      scroll.captured = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setGrabbing(true);
      setFromBelt(null);
      setFromList(null);
      logDebug(
        `drag start: pointer travelled ${travel.toFixed(0)}px (> ${DRAG_THRESHOLD_PX}px threshold) — knob engaged, camera stays locked`,
      );
    }
    const now = e.timeStamp;
    const { clientWidth, clientHeight } = e.currentTarget;
    // Knob behavior: only the component of the pointer delta along the
    // line's screen direction turns into movement, so the tiles always
    // travel diagonally along their own line.
    const ds = pointerToTiles(
      e.clientX - scroll.lastX,
      e.clientY - scroll.lastY,
      clientWidth,
      clientHeight,
    );
    scroll.target += ds;
    // Smoothed release velocity from the last couple of samples.
    const dt = Math.max((now - scroll.lastT) / 1000, 1 / 120);
    scroll.velocity = THREE.MathUtils.lerp(scroll.velocity, ds / dt, 0.5);
    scroll.lastX = e.clientX;
    scroll.lastY = e.clientY;
    scroll.lastT = now;
  };

  const endDrag = () => {
    const scroll = scrollRef.current;
    if (scroll.captured) {
      logDebug(
        `drag end: scroll at ${scroll.target.toFixed(2)} tile units, release velocity ${scroll.velocity.toFixed(2)} tiles/s — flywheel glide, belt wraps infinitely`,
      );
    }
    scroll.active = false;
    scroll.captured = false;
    setGrabbing(false);
  };

  // Wheel / trackpad scrubs the same belt (both axes). Left un-prevented so a
  // vertical scroll still carries the page down to the footer — it just spins
  // the carousel on the way past.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const scroll = scrollRef.current;
    if (scroll.active || expandedRole !== null) return;
    scroll.target += (e.deltaY + e.deltaX) * WHEEL_FACTOR;
  };

  return (
    <>
      {/* Shared Unicorn Studio WebGL background — same fixed scene as the
          main page (z -10); the transparent canvas lets it show through. */}
      <UnicornBackground />
      <main className="relative w-full max-w-full overflow-x-hidden">
        {/* touch-pan-y (not touch-none): vertical swipes scroll the page so
            touch users can reach the footer; horizontal swipes scrub the
            belt via the pointer handlers. */}
        <section
          className={`relative h-dvh w-full touch-pan-y select-none overflow-hidden ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
        >
          <h1 className="sr-only">Careers at Zuhayr Creative</h1>

      <Canvas
        className="absolute inset-0"
        camera={{
          position: CAM_POS,
          rotation: [CAM_PITCH, 0, 0],
          fov: FOV,
          near: 0.1,
          far: 1000,
        }}
        dpr={[1, 2]}
      >
        {/* No scene background — the canvas stays transparent (alpha), like
            the reference, so whatever is behind the page shows through. */}
        <LayoutLogger />
        <Suspense fallback={null}>
          <Rig scrollRef={scrollRef}>
            {Array.from({ length: SLOT_COUNT }, (_, k) => {
              const role = k % PANELS.length;
              return (
                <Panel
                  key={k}
                  data={PANELS[role]}
                  slot={k}
                  hovered={hoveredRole === role}
                  onEnter={() => enterRole(role, "belt")}
                  onLeave={() => leaveRole(role, "belt")}
                  onSelect={() => setExpandedRole(role)}
                  scrollRef={scrollRef}
                  instant={prefersReducedMotion}
                />
              );
            })}
          </Rig>
          </Suspense>
        </Canvas>

        {/* Mobile: a bottom scrim so the index list (anchored low on phones)
            stays legible over the belt/background. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent sm:hidden"
        />

        {/* Index list — one row per role, cross-linked to the belt. The
            container ignores the pointer; only the left title and right meta
            of each row are interactive, so the middle stays click-through and
            the pictures underneath remain hoverable. On phones it anchors to
            the bottom (out from under the centred belt); centred on ≥sm. */}
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end pb-20 gap-1.5 px-6 sm:justify-center sm:pb-0 sm:gap-2 md:px-12">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/50 [text-shadow:0_1px_10px_rgba(0,0,0,0.55)]">
            Open Roles <span className="align-super text-[8px]">({PANELS.length})</span>
          </p>
          {PANELS.map((role, i) => {
            const active = hoveredRole === i;
            return (
              <div
                key={role.alt}
                className="flex items-baseline justify-between [text-shadow:0_1px_10px_rgba(0,0,0,0.55)]"
              >
                <button
                  type="button"
                  onMouseEnter={() => enterRole(i, "list")}
                  onMouseLeave={() => leaveRole(i, "list")}
                  onClick={() => setExpandedRole(i)}
                  className={`pointer-events-auto text-left text-lg font-medium transition-all duration-300 sm:text-2xl md:text-[1.75rem] ${active ? "translate-x-3 text-white" : "translate-x-0 text-white/60 hover:text-white/80 sm:text-white/40 sm:hover:text-white/70"}`}
                >
                  {role.alt}
                </button>
                <button
                  type="button"
                  onMouseEnter={() => enterRole(i, "list")}
                  onMouseLeave={() => leaveRole(i, "list")}
                  onClick={() => setExpandedRole(i)}
                  className={`pointer-events-auto hidden text-right text-[11px] uppercase tracking-[0.14em] transition-colors duration-300 sm:block ${active ? "text-white" : "text-white/40"}`}
                >
                  {role.meta} · {role.year}
                </button>
              </div>
            );
          })}
        </div>
        </section>
        {/* Footer is shared — rendered site-wide by the template (SiteFooter). */}
      </main>

      {/* ── Expand-to-centre lightbox ──────────────────────────────────────
          Clicking an image (or its index row) grows the picture up into the
          middle of the screen with its role beneath it. Click anywhere, the
          ✕, or Escape to close. */}
      {expandedRole !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${PANELS[expandedRole].alt} — expanded`}
          onClick={closeLightbox}
        >
          <div
            className={`absolute inset-0 bg-[#1a070d]/85 backdrop-blur-md transition-opacity duration-300 ${lightboxShown ? "opacity-100" : "opacity-0"}`}
          />
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Close"
            className="absolute right-6 top-6 z-[2] flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
          >
            <span className="text-2xl leading-none">×</span>
          </button>
          <figure
            onClick={(e) => e.stopPropagation()}
            className={`relative z-[1] flex flex-col items-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${lightboxShown ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-90 opacity-0"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PANELS[expandedRole].src}
              alt={PANELS[expandedRole].alt}
              className="max-h-[68vh] w-auto rounded-[4px] object-cover shadow-[0_30px_90px_-25px_rgba(0,0,0,0.8)]"
            />
            <figcaption className="mt-5 flex flex-col items-center text-center">
              <span className="text-2xl font-medium text-white sm:text-3xl">
                {PANELS[expandedRole].alt}
              </span>
              <span className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-white/55">
                {PANELS[expandedRole].meta} · {PANELS[expandedRole].year}
              </span>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
