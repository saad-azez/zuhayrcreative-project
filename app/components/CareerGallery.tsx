"use client";

import {
  Suspense,
  useCallback,
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
import { useSplashHover } from "./useSplashHover";
import { useImageTrail, TRAIL_HIDDEN_CLIP } from "@/app/animations/useImageTrail";
import type { TrailRect } from "@/app/animations/repeatingImageTransition";
import UnicornBackground from "./UnicornBackground";
import ChromaticMetal from "./ChromaticMetal";

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
// The role artwork is square, the slab is 4:5 — so "contain" the image instead
// of stretching it: widen the sampled V range to the slab's aspect ratio and
// re-centre it. The bands above and below fall outside [0,1] and clamp to the
// artwork's fully transparent edge pixels, so the letterboxing is invisible.
const PANEL_UV_REPEAT_Y = PANEL_SIZE[1] / PANEL_SIZE[0];
const PANEL_UV_OFFSET_Y = (1 - PANEL_UV_REPEAT_Y) / 2;

/**
 * The open roles, in alphabetical order. Each entry is ONE role: it owns a
 * picture on the belt AND a row in the index list, and the two are linked —
 * hovering either highlights the pair and slides the picture out to the right.
 *
 * The artwork is square (2000×2000) with a transparent background, so it is
 * letterboxed — not cropped — onto the 4:5 slabs (see PANEL_UV_REPEAT_Y); the
 * icons read as floating on the belt rather than printed on a card.
 */
interface PanelDef {
  src: string;
  alt: string;
  meta: string;
  year: string;
}

const PANELS: PanelDef[] = [
  { src: "/careers/ai-specialist.png", alt: "AI Specialist", meta: "Technology", year: "2026" },
  { src: "/careers/creative-direction.png", alt: "Creative Direction", meta: "Art & Design", year: "2026" },
  { src: "/careers/designer.png", alt: "Designer", meta: "Design", year: "2026" },
  { src: "/careers/motion-design.png", alt: "Motion Design", meta: "3D & Animation", year: "2026" },
  { src: "/careers/web-developer.png", alt: "Web Developer", meta: "Development", year: "2026" },
];

/** Where applications go — shown when a role's image is expanded. */
const CAREERS_EMAIL = "careers@zuhayrcreative.org";

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

/** Slot index → where that panel is on screen right now, in viewport px. */
type PanelRectFn = (slot: number) => TrailRect | null;

// Scratch vectors for the projection below — reused, never allocated per call.
const _pCentre = new THREE.Vector3();
const _pEdgeX = new THREE.Vector3();
const _pEdgeY = new THREE.Vector3();
const _pAxis = new THREE.Vector3();

/**
 * Publishes a "where is panel N on screen" function up to the section.
 *
 * Lives inside the Canvas because it is the only place with the camera. The
 * image trail uses it as its origin, the same way the seasons globe projects
 * the grid tile that was clicked: the trail then flies from and back to the
 * actual slab rather than from a fixed box guessed at the pointer.
 */
function PanelProjector({
  meshes,
  onReady,
}: {
  meshes: RefObject<(THREE.Object3D | null)[]>;
  onReady: (fn: PanelRectFn | null) => void;
}) {
  const camera = useThree((s) => s.camera);
  const glCanvas = useThree((s) => s.gl.domElement);

  const project = useCallback<PanelRectFn>(
    (slot: number) => {
      const obj = meshes.current[slot];
      if (!obj || !glCanvas) return null;
      const canvas = glCanvas.getBoundingClientRect();
      if (!canvas.width || !canvas.height) return null;

      obj.updateWorldMatrix(true, false);
      _pCentre.setFromMatrixPosition(obj.matrixWorld);
      // The slab is rotated on Y, so its half-width runs along its OWN x axis,
      // not the world's — take both axes from the world matrix so the projected
      // box is foreshortened exactly as the panel is.
      _pEdgeX
        .copy(_pCentre)
        .add(
          _pAxis
            .set(1, 0, 0)
            .transformDirection(obj.matrixWorld)
            .multiplyScalar(PANEL_SIZE[0] / 2),
        );
      _pEdgeY
        .copy(_pCentre)
        .add(
          _pAxis
            .set(0, 1, 0)
            .transformDirection(obj.matrixWorld)
            .multiplyScalar(PANEL_SIZE[1] / 2),
        );

      _pCentre.project(camera);
      if (_pCentre.z > 1) return null; // behind the camera
      _pEdgeX.project(camera);
      _pEdgeY.project(camera);

      const toX = (v: THREE.Vector3) =>
        canvas.left + (v.x * 0.5 + 0.5) * canvas.width;
      const toY = (v: THREE.Vector3) =>
        canvas.top + (-v.y * 0.5 + 0.5) * canvas.height;

      const cx = toX(_pCentre);
      const cy = toY(_pCentre);
      const halfW = Math.abs(toX(_pEdgeX) - cx);
      const halfH = Math.abs(toY(_pEdgeY) - cy);
      if (!halfW || !halfH) return null;

      return {
        left: cx - halfW,
        top: cy - halfH,
        width: halfW * 2,
        height: halfH * 2,
      };
    },
    [camera, glCanvas, meshes],
  );

  useEffect(() => {
    onReady(project);
    return () => onReady(null);
  }, [onReady, project]);

  return null;
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
  registerMesh,
}: {
  data: PanelDef;
  slot: number;
  hovered: boolean;
  onEnter: () => void; // pointer entered this slot — links to its role
  onLeave: () => void;
  onSelect: () => void; // click (not drag) → expand this image to centre
  scrollRef: RefObject<ScrollState>;
  instant: boolean; // prefers-reduced-motion — skip the intro/lift animation
  /** Hands the visible slab up so its on-screen box can be projected. */
  registerMesh: (slot: number, obj: THREE.Object3D | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
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
    const g = group.current;
    const m = mesh.current;
    const material = mat.current;
    if (!g || !m || !material) return;

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

    // The GROUP rides the belt: this slot's spot on the line, shifted by the
    // shared scroll and wrapped around the (off-screen) ends. The hover slide
    // is applied to the visible slab INSIDE the group, so the hit proxy stays
    // put — see the proxy mesh below for why that matters.
    const lineT = wrapT(slotOffset(slot) + scrollRef.current.current);
    g.position
      .copy(STEP)
      .multiplyScalar(lineT)
      .addScaledVector(INTRO_FROM, 1 - ease);
    m.position.copy(HOVER_SHIFT).multiplyScalar(liftCur.current);

    opacityCur.current = THREE.MathUtils.damp(
      opacityCur.current,
      hovered ? 1 : BASE_OPACITY,
      8,
      dt,
    );
    material.opacity = ease * opacityCur.current;
  });

  return (
    <group ref={group}>
      {/*
        Hit proxy — invisible, and deliberately NOT moved by the hover slide.

        Hit-testing the slab that hover MOVES is a feedback loop: LIFT (0.6) is
        larger than the panel's projected half-width (~0.57), so a cursor on the
        left half of a tile ends up outside it the moment it slides right →
        pointerout → the tile slides back under the cursor → pointerover → it
        jumps out again. That oscillation is the flicker. Any non-zero slide has
        some unstable band, so the fix is to decouple the two: the pointer state
        is owned by this stationary quad at the slot's resting spot, and the
        picture is free to slide out of it and back.

        colorWrite={false} rather than visible={false} — an invisible object is
        not reliably raycast, whereas one that simply writes no pixels is.
      */}
      <mesh
        rotation={[0, ROT_Y, 0]}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          // Only the front-most panel under the cursor should pop.
          e.stopPropagation();
          if (!scrollRef.current.captured) onEnter();
        }}
        onPointerOut={onLeave}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          // A press that never became a drag (see DRAG_THRESHOLD_PX) is a
          // click: expand this image to the centre. stopPropagation so only
          // the front-most panel opens.
          e.stopPropagation();
          if (!scrollRef.current.captured) onSelect();
        }}
      >
        <boxGeometry args={[PANEL_SIZE[0], PANEL_SIZE[1], PANEL_DEPTH]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>

      {/* The visible slab. raycast is stubbed out so it can never re-introduce
          the loop the proxy exists to break. */}
      <mesh
        ref={(el) => {
          mesh.current = el;
          registerMesh(slot, el);
        }}
        rotation={[0, ROT_Y, 0]}
        raycast={() => null}
      >
        {/* Thin box, not a plane — the reference tiles are 0.0175-thick glass
            slabs whose edges catch the eye at this angle. */}
        <boxGeometry args={[PANEL_SIZE[0], PANEL_SIZE[1], PANEL_DEPTH]} />
        {/* Dashed props: R3F applies the nested texture settings itself.
            Panels are viewed at a steep angle — anisotropy keeps them crisp
            (three clamps it to the device max).

            `side` is FrontSide, NOT DoubleSide. The slab above is a BOX, so this
            material is on all six faces; with DoubleSide the far face rendered
            too, and because the artwork is a transparent PNG drawn with
            depthWrite off, it showed straight through the empty areas of the
            near one — offset by the slab's depth at the belt's viewing angle.
            Every panel came out as two copies of the same picture, one behind
            the other. Culling the far face costs nothing here: the panels sit on
            a line and always face the camera, so the back of a slab is never
            meant to be seen, and the outward-facing edges still render so the
            slab keeps its thickness. */}
        <meshBasicMaterial
          ref={mat}
          map={texture}
          map-colorSpace={THREE.SRGBColorSpace}
          map-anisotropy={16}
          map-wrapS={THREE.ClampToEdgeWrapping}
          map-wrapT={THREE.ClampToEdgeWrapping}
          map-repeat-y={PANEL_UV_REPEAT_Y}
          map-offset-y={PANEL_UV_OFFSET_Y}
          transparent
          opacity={0}
          side={THREE.FrontSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
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

  // Cursor splash — ONLY on the expanded picture. The belt is WebGL, not DOM,
  // so the hook (which overlays a canvas on an <img>) has nothing to attach to
  // there anyway; gating on `expandedRole` also means no GL context is created
  // until a role is actually opened. The host is the wrapper immediately around
  // the <img> so the canvas lands in the same box — and inherits the same
  // drop-shadow — as the picture it replaces.
  const splashRef = useRef<HTMLDivElement>(null);
  useSplashHover(splashRef, expandedRole !== null);
  const lightboxImgRef = useRef<HTMLImageElement>(null);
  const lightboxCapRef = useRef<HTMLElement>(null);
  const trail = useImageTrail();

  // ── Trail origin: the panel that was clicked, not the pointer ──────────────
  // Same treatment as the seasons globe. The belt's slabs are WebGL, so there is
  // no element to measure; PanelProjector (inside the Canvas, where the camera
  // lives) hands up a function that reports a slot's on-screen box, and the
  // trail asks it at play time. Handing over a getter rather than a box also
  // covers the belt settling between the click and the trail actually running.
  const slotMeshes = useRef<(THREE.Object3D | null)[]>([]);
  const registerMesh = useCallback(
    (slot: number, obj: THREE.Object3D | null) => {
      slotMeshes.current[slot] = obj;
    },
    [],
  );
  const panelRect = useRef<PanelRectFn | null>(null);
  const handlePanelRect = useCallback((fn: PanelRectFn | null) => {
    panelRect.current = fn;
  }, []);
  const clickedSlot = useRef(0);

  const openRole = (slot: number, role: number) => {
    clickedSlot.current = slot;
    trail.captureOrigin(() => panelRect.current?.(clickedSlot.current) ?? null);
    setExpandedRole(role);
  };

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
  // Close through the repeating image trail: the artwork wipes off and the
  // clones fly back to the belt panel that was clicked, and only then does the
  // lightbox unmount — it has to stay mounted for the animation to have a
  // subject. `lightboxShown` still drives the caption's fade.
  const closeLightbox = () => {
    setLightboxShown(false);
    const img = lightboxImgRef.current;
    if (prefersReducedMotion || !img || expandedRole === null) {
      window.setTimeout(() => setExpandedRole(null), 320);
      return;
    }
    trail.exit(img, PANELS[expandedRole].src, () => setExpandedRole(null));
  };

  useEffect(() => {
    if (expandedRole === null) return;
    const raf = requestAnimationFrame(() => setLightboxShown(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    logDebug(
      `expand: "${PANELS[expandedRole].alt}" (role ${expandedRole}) → centre lightbox`,
    );
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedRole]);

  // Entrance: trail in from the belt panel (WebGL, so the hook falls back to
  // the point that was clicked), then wipe the artwork on.
  useEffect(() => {
    if (expandedRole === null) return;
    const img = lightboxImgRef.current;
    if (!img) return;
    if (prefersReducedMotion) {
      img.style.clipPath = "none";
      return;
    }
    trail.enter(img, PANELS[expandedRole].src, lightboxCapRef.current);
  }, [expandedRole, prefersReducedMotion, trail]);

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
          <PanelProjector meshes={slotMeshes} onReady={handlePanelRect} />
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
                  onSelect={() => openRole(k, role)}
                  scrollRef={scrollRef}
                  instant={prefersReducedMotion}
                  registerMesh={registerMesh}
                />
              );
            })}
          </Rig>
          </Suspense>
        </Canvas>

        {/* No phone scrim. There used to be a black gradient over the bottom
            78% of the section on phones, with the list anchored low beneath
            it; the client read it as a stray black blur and the page as a
            different design from desktop. The list now sits centred at every
            width, as on desktop, legible by its text shadow alone. */}

        {/* Index list — one row per role, cross-linked to the belt. The
            container ignores the pointer; only the left title and right meta
            of each row are interactive, so the middle stays click-through and
            the pictures underneath remain hoverable. Centred at every width. */}
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-center gap-1.5 px-5 sm:gap-2 sm:px-6 md:px-12">
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
                {/* The role, and its discipline opposite. Both at EVERY
                    width: the discipline used to be `hidden sm:block`, so a
                    phone got five bare job titles where a desktop gets a
                    two-column index — which is most of why the page read as a
                    different design there. It fits, measured: at 390px the
                    row has 342px to spend, the longest title sets 183px at
                    16px and the longest discipline 139px at 9px. The two
                    sizes scale with the viewport between those and the
                    desktop's, so the pair stays on one line from a small
                    phone up. */}
                <button
                  type="button"
                  onMouseEnter={() => enterRole(i, "list")}
                  onMouseLeave={() => leaveRole(i, "list")}
                  onClick={() => setExpandedRole(i)}
                  className={`pointer-events-auto whitespace-nowrap text-left text-[clamp(0.95rem,4.1vw,1.25rem)] font-medium transition-all duration-300 sm:text-2xl md:text-[1.75rem] ${active ? "translate-x-3 text-white" : "translate-x-0 text-white/40 hover:text-white/70"}`}
                >
                  {role.alt}
                </button>
                <button
                  type="button"
                  onMouseEnter={() => enterRole(i, "list")}
                  onMouseLeave={() => leaveRole(i, "list")}
                  onClick={() => setExpandedRole(i)}
                  className={`pointer-events-auto shrink-0 whitespace-nowrap pl-3 text-right text-[clamp(8px,2.3vw,11px)] uppercase tracking-[0.1em] transition-colors duration-300 sm:tracking-[0.14em] ${active ? "text-white" : "text-white/40"}`}
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
          {/* Mirrors the navbar toggle on the opposite side: same safe-area
              offsets, same 14/16 square with the 10px radius and liquid-glass
              treatment — so the ✕ and the hamburger read as one pair sitting on
              the same line. Keep these in sync with <Navbar>'s toggle. */}
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Close"
            /* Fades in and out with the scrim and the caption, on the same
               flag, instead of vanishing.

               It used to carry lg-drop, which is an ENTRANCE keyframe with
               fill-mode `both`: once it finished it PINNED opacity at 1, and
               no CSS opacity could move it afterwards. So the button sat at
               full strength while the artwork flew back to the belt and then
               blinked out with the unmount — the client saw a ✕ that did not
               animate on the way out.

               Swapping the animation for a transition on close does not work
               either, and was tried: a transition will not interpolate from a
               value an animation was holding, so it jumped straight to 0. So
               there is no animation on this element at all now, and both
               directions are the one transition — which is what the scrim and
               the figure beside it already do.

               The transition itself comes from lg-gulp, which names opacity
               as well as transform; a Tailwind transition-opacity utility
               written here would LOSE to it, because that rule uses the
               shorthand and is unlayered. See the note on .lg-gulp. */
            className={`liquid-glass lg-gulp absolute top-[calc(var(--safe-top)+1rem)] right-[calc(var(--safe-right)+0.75rem)] z-[2] flex h-14 w-14 items-center justify-center rounded-[10px] text-white/80 hover:text-white md:top-[calc(var(--safe-top)+1.5rem)] md:right-[calc(var(--safe-right)+1.25rem)] md:h-16 md:w-16 ${
              lightboxShown ? "opacity-100" : "opacity-0"
            }`}
          >
            <ChromaticMetal />
            <span className="text-2xl leading-none">×</span>
          </button>
          <figure
            onClick={(e) => e.stopPropagation()}
            // Opacity only. The scale/translate entrance that used to be here
            // moved the artwork on the way in, which both fought the trail and
            // meant the image was not at its final position while the clones
            // were flying to it. The trail is the entrance now; this just fades
            // the caption in alongside it.
            className={`relative z-[1] flex flex-col items-center transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${lightboxShown ? "opacity-100" : "opacity-0"}`}
          >
            {/* The artwork is a transparent PNG, so the glow comes from a
                drop-shadow filter (follows the alpha) rather than a box
                shadow, which would draw a rectangle under a floating icon.
                The filter lives on this wrapper, not the <img>: the splash
                canvas is a sibling inside it, so the shadow survives the swap
                between the two. */}
            <div
              ref={splashRef}
              className="relative [filter:drop-shadow(0_25px_55px_rgba(0,0,0,0.55))]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={lightboxImgRef}
                src={PANELS[expandedRole].src}
                alt={PANELS[expandedRole].alt}
                className="block max-h-[42vh] w-auto object-contain"
                // Starts clipped so there is no unclipped frame before the
                // entrance runs. Only clip-path animates, so the artwork's
                // position and size are exactly what they always were.
                style={
                  prefersReducedMotion
                    ? undefined
                    : { clipPath: TRAIL_HIDDEN_CLIP }
                }
              />
            </div>
            <figcaption
              ref={lightboxCapRef}
              className="mt-5 flex flex-col items-center text-center"
            >
              <span className="text-2xl font-medium text-white sm:text-3xl">
                {PANELS[expandedRole].alt}
              </span>
              <span className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-white/55">
                {PANELS[expandedRole].meta} · {PANELS[expandedRole].year}
              </span>
              {/* Application call-to-action — the whole point of expanding a
                  role. The mailto is a real link, so it must stay above the
                  backdrop's click-to-close handler (the <figure> already
                  stops propagation). */}
              <span className="mt-6 max-w-[34ch] text-balance text-sm leading-relaxed text-white/75 sm:text-base">
                We await your application! Please submit your resume/portfolio
                to this address —{" "}
                {/* Same hover idiom as the footer's email link: the address
                    goes brand-red and a red rule wipes across the resting
                    hairline left→right. */}
                <a
                  href={`mailto:${CAREERS_EMAIL}?subject=${encodeURIComponent(`Application — ${PANELS[expandedRole].alt}`)}`}
                  className="group/email relative whitespace-nowrap font-medium text-white transition-colors duration-300 hover:text-title-red"
                >
                  <span className="relative">
                    {CAREERS_EMAIL}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -bottom-0.5 left-0 h-px w-full bg-white/20"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-title-red transition-transform duration-500 ease-out group-hover/email:scale-x-100"
                    />
                  </span>
                </a>
              </span>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
