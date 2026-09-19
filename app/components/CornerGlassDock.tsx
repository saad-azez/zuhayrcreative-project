"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const noopSubscribe = () => () => {};
import { LiquidField, type FieldBody } from "./liquidField";
import { subscribeGlassCube } from "./ChromaticMetal";
import "@/app/styles/corner-dock.css";
import { isPhoneDevice } from "@/app/lib/device";

/* The corner's beacon starts a moment after the loader's reveal and then
   keeps its beat for as long as the corner is clear and the dock is shut.
   It used to come and go — up 14s, away 20s — and the client read the gaps
   as the ripple failing: "sometimes it doesn't appear". */
const FIRST_DELAY_MS = 2_500;
/* One beat of the beacon: a white wave out of the + and a splash into the
   water, every BEAT_MS. */
const BEAT_MS = 2_800;
/* How long the + stays after the pointer leaves the corner, so a hand
   that wandered off the ripple can come back for it. */
const HOT_LINGER_MS = 1_500;
/* On close the glyphs blur out before the glass moves (in the film the
   icons dissolve as the neck reforms, ahead of the bodies merging). */
const CLOSE_DELAY_MS = 90;
/* On hide the + dives into the glass first — the frog into the pond —
   and only then does the drop sink back into the centre. */
const HIDE_DELAY_MS = 240;

/* The occasion's stamps, in the folder slot (see .cgd-stamp in the
   CSS). Per the client's reference, AdityaSur11's "Stamp Folder
   animation": stamps tucked in a frosted folder that slide out of its
   edge on hover, fanned. Back to front; the last is the front one, and
   goes furthest. Swap these for whatever is being celebrated or
   highlighted — a seasonal mark, an event, a launch — anything that
   reads at ~24px on a cream stamp. Placeholders: the Hong Kong pin and
   the cursor's emblem. */
const STAMPS: ReadonlyArray<{ art: string; paper?: string }> = [
  // Through the image optimizer, not the raw file. The art is painted as a CSS
  // background at 22px, and the source PNG is 749x961 and 580KB — it was the
  // single largest download on the landing page, fetched at boot on every
  // route, and on a slow phone the last thing the browser's load event waited
  // on. `w=96` (one of next.config's imageSizes) covers 22px at a 3x screen
  // and comes back as a few-KB WebP/AVIF. Same URL shape next/image builds.
  { art: "/_next/image?url=%2Fhongkongmapicon.png&w=96&q=75" },
  { art: "/AI-9-cursor.png" },
];
const STAMP_W = 30;
const STAMP_H = 40;
/* The folder itself, per the client's film (Screen Recording 2026-09-08
   070238) and their note on it: once the halves part, the folder half is
   not a square but a portrait envelope — taller than wide, tighter
   corners — and a 3D one. Hover it and its front cracks open a little
   while BOTH stamps slide out together, stacked one on the other, sharp
   where they clear it; click it and the front swings open and both slide
   a little further, still of the folder. No label.
   50x62 is the film's portrait (0.8), sized so the envelope keeps clear
   of the pill above and the bubble's row below: bodies within ~8px of each
   other grow a neck. */
const FOLDER_W = 50;
const FOLDER_H = 62;
const FOLDER_R = 11;

/* ── Geometry (CSS px) ──
   The seed is the + box, 18px in from the corner (that margin lives in
   the CSS offsets of .cgd-stage and .cgd-corner). The stage that holds
   the glass extends EDGE past it, room for the shadow. */
const EDGE = 26;
const PAD_LEFT = 34;
const PAD_TOP = 34;
const SEED = 52;
const BOX_R = 16;
/* With the glass cube (see ChromaticMetal's cube shader) the seed's
   spring still runs — the cube rides on it and scales with it, so it
   wells up and sinks as the drop does — but its body is NOT painted in
   the liquid sheet: nothing flat sits under the cube. The boxes are born
   at its centre and grow out from under it. The cube is the flat box's
   52px with 16px corners; its canvas is larger so a turned cube's
   corners are not clipped. Its frosted skin, the flat box's own, is a
   layer under it clipped to the cube's silhouette, traced from the
   rendered alpha each frame. */
const CORE = 20;
const CORE_R = 10;
const CUBE_PX = 84;
/* Resting gap between bodies. The goo scale at rest (S_REST) must be well
   under GAP / 1.4, or two neighbours would keep a neck between them. */
const GAP = 16;
/* The pad: the client's film (Screen Recording 2026-09-14 093051),
   measured at 30fps. Three round buttons bud off the + and stand round it
   like a game pad's face buttons, the + — turned × — the bottom one: left
   and right 1.5 diameters out and 0.62 up, the top 1.51 up. They leave in
   turn — left, the top a frame later, the right three frames after — each
   small and growing as it travels, settled in ~0.4s. Shutting, each
   squeezes to a thin upright oval where it stands and is gone in ~6
   frames. The film's pad floats free; ours lives in the corner, where the
   right button would stand off the screen — so on opening the + glides one
   step left and the right button takes the corner it left, and on shutting
   it glides back once the buttons are gone. */
const PAD_DX = Math.round(SEED * 1.5);
const PAD_DY_SIDE = Math.round(SEED * 0.62);
const PAD_DY_TOP = Math.round(SEED * 1.51);
const TOP_DELAY_MS = 35;
const RIGHT_DELAY_MS = 100;
/* Desktop: the + glides its step left FIRST, and only then do the buttons
   bud off it. Born at the same instant as the glide they seemed to pop out
   beside a moving + rather than morph out of a standing one — the film's
   + never moves while its buttons leave it (the client, on the ref). The
   glide's spring is most of the way in ~240ms. Phones: the + stays put,
   so the buttons bud at once. */
const GLIDE_FIRST_MS = 240;
/* The PHONE pad — the client's mockup of 18 Sep: a phone screen has no
   room for the desktop's row, so the three buttons fan round the + in
   its corner instead, a quarter circle: one straight above, one straight
   to the left, one on the diagonal between them. The + stays put (no
   glide out of the corner; nothing needs the corner it would leave).
   Which button takes which spot follows what each carries: the folder
   goes LEFT, where its stamps slide out into open space; the AI box goes
   on the DIAGONAL; start-a-project takes the top, and the AI box's
   bubble stands in a row above the whole fan (see layoutFor). The radii
   keep the desktop pad's breathing room — the mockup's marks sit closer
   in, but 52px bodies on a tighter arc would neck into each other at
   rest (bodies within ~8px grow a neck): as set, the nearest neighbours
   are 14 and 16px apart. */
const PHONE_TOP = 90;
const PHONE_SIDE = 96;
const PHONE_DIAG_X = 66;
const PHONE_DIAG_Y = 68;
/* The shut: the squeeze's thin upright oval, and how long after the shut
   the + waits for the buttons to be gone before it glides home. */
const SQUEEZE_W = 6;
const SQUEEZE_H = Math.round(SEED * 0.75);
const HOME_DELAY_MS = 260;
/* How long the folder stays the envelope after the pointer leaves it. */
const APART_LINGER_MS = 160;
/* The joystick — the detail the film turns on. The + (and, open, the ×) is
   drawn to the pointer: within REACH_RANGE the body reaches a liquid tail
   towards it, a share of the distance up to REACH_MAX, thick at the root
   and rounded at the tip; its glyph leans a few px after it while the dot
   at its centre stays home. Pointing at a button, the reach lands on that
   button and the tail becomes a bridge whose outline takes the button's
   colour, the button glowing with it. The pointer gone, the tail springs
   back with a little wobble. Pointer-driven, so touch only gets the bridge
   while a button is pressed. */
const REACH_RANGE = 190;
const REACH_SHARE = 0.58;
const REACH_MAX = 64;
const TAIL_END = 16;
const TAIL_ROOT = 26;
const BEADS = 5;
const TAIL_K = 230;
const TAIL_ZETA = 0.55;
const GLYPH_LEAN = 6;
/* The film's colours: the top button magenta, the left red, the right
   green. */
const HOT_COLOR = { ai: "#e56bff", folder: "#ff4d6d", cta: "#3ddc84" } as const;
type Lit = keyof typeof HOT_COLOR;
/* The AI button's "coming soon" bubble: a pill above the pad, budded off
   the top of the AI button. Its height is the circle it forms as first. */
const BUBBLE_H = 40;
/* The bead the bubble is on the way out and on the way back in — small
   enough to pass the envelope's corner without necking to it. */
const BEAD = 12;
/* How long the bubble stays after the pointer leaves the AI slot, and
   how long a tap on it (no hover on touch) keeps it out. */
const BUBBLE_LINGER_MS = 500;

/* ── Motion ──
   Every box is a damped spring on (x, y, w, h, r). ZETA under 1 gives the
   film's overshoot — the bodies land a hair past their place and ease
   back. Each body's goo scale runs from S_REST when still to S_FLOW at
   full speed: stringy while it flies (two flying bodies hold a neck to
   ~17px of gap) and crisp once it stops, which is what pinches the neck.
   A body a bud is leaving inherits the bud's scale, so the neck runs
   from the parent; a resting pair never grows one. Surface waves and the
   along-motion stretch are likewise speed-driven, so a resting body is a
   clean rectangle. */
const K = 150;
/* Critically damped: the 27 Aug film's glass settles without a bounce,
   so the bodies glide to their places and stop. The necks still form and
   snap — that is the field's doing, not the spring's. */
const ZETA = 1.0;
const DAMP = 2 * Math.sqrt(K) * ZETA;
const S_REST = 5;
const S_FLOW = 12;
const FULL_SPEED = 420;
const SWELL = 4;
const PRESS = -3;

/* The AI slot's 5×5 LED matrix, modelled on the reference's Record icon:
   a round cluster of dots (corners stay dark), centre brightest, each
   dot's breathing delayed by its distance from centre so the pulse
   travels outward as a wave. Computed once — it's geometry, not state. */
const LED_DOTS = Array.from({ length: 25 }, (_, i) => {
  const dist = Math.hypot((i % 5) - 2, Math.floor(i / 5) - 2);
  return {
    lit: dist <= 2.4,
    base: Math.max(0.3, 1 - dist * 0.24),
    delay: Math.round(dist * 150),
  };
});

interface Layout {
  W: number;
  H: number;
  /** The + at rest, in the corner. */
  seed: { x: number; y: number };
  /** The + while the pad is out: one step left of the corner. */
  seedOut: { x: number; y: number };
  /** The pad's buttons round it: the stamp folder left (its stamps slide
      out into open space), the AI doorway on top (its bubble rises into
      the room above), start-a-project right, in the corner. */
  folder: { x: number; y: number };
  ai: { x: number; y: number };
  cta: { x: number; y: number };
  /** The bubble's resting centre, above the AI button. */
  bubble: { x: number; y: number };
}

function layoutFor(bubbleW: number, phone = false): Layout {
  if (phone) {
    // The stage is as wide as the fan or the bubble's pill needs, whichever
    // is more — the pill (~208px) is wider than the fan.
    const W = Math.max(
      EDGE + SEED / 2 + PHONE_SIDE + FOLDER_W / 2 + PAD_LEFT,
      PAD_LEFT + bubbleW + EDGE
    );
    const H = EDGE + SEED / 2 + PHONE_TOP + SEED / 2 + GAP + BUBBLE_H + PAD_TOP;
    const seed = { x: W - EDGE - SEED / 2, y: H - EDGE - SEED / 2 };
    const folder = { x: seed.x - PHONE_SIDE, y: seed.y };
    const ai = { x: seed.x - PHONE_DIAG_X, y: seed.y - PHONE_DIAG_Y };
    const cta = { x: seed.x, y: seed.y - PHONE_TOP };
    // The bubble's pill stands in a row ABOVE the whole fan, its right end
    // on the corner column: centred on the diagonal AI box it ran into the
    // top button and out of the stage's left edge (verified with the
    // field's own distance function — overlapping bodies fuse whatever
    // the goo scale). Its bead still rises out of the AI box's top.
    const bubble = { x: W - EDGE - bubbleW / 2, y: cta.y - SEED / 2 - GAP - BUBBLE_H / 2 };
    return { W, H, seed, seedOut: seed, folder, ai, cta, bubble };
  }
  const reach = Math.max(PAD_DX * 2 + SEED, PAD_DX + SEED / 2 + bubbleW / 2);
  const W = PAD_LEFT + reach + EDGE;
  const H = PAD_TOP + BUBBLE_H + GAP + PAD_DY_TOP + SEED + EDGE;
  const RX = W - EDGE;
  const seed = { x: RX - SEED / 2, y: H - EDGE - SEED / 2 };
  const seedOut = { x: seed.x - PAD_DX, y: seed.y };
  const sideY = seedOut.y - PAD_DY_SIDE;
  const folder = { x: seedOut.x - PAD_DX, y: sideY };
  const cta = { x: seedOut.x + PAD_DX, y: sideY };
  const ai = { x: seedOut.x, y: seedOut.y - PAD_DY_TOP };
  const bubble = { x: ai.x, y: ai.y - SEED / 2 - GAP - BUBBLE_H / 2 };
  return { W, H, seed, seedOut, folder, ai, cta, bubble };
}

type Vec5 = readonly [number, number, number, number, number];
/** A waypoint on a body's route, and the condition to leave it on. */
type Leg = readonly [Vec5, (s: Slot) => boolean];

/** One box: a 5-way spring (x, y, w, h, r) and the field body it drives. */
class Slot {
  cur = new Float64Array(5);
  vel = new Float64Array(5);
  tgt = new Float64Array(5);
  speed = 0;
  body: FieldBody = { x: 0, y: 0, w: 0, h: 0, r: 0, wob: 0, s: S_REST };
  /** Position speed alone (px/s); `speed` also counts size change. */
  travel = 0;
  /** Spring stiffness and damping; the joystick's tail is looser. */
  k = K;
  damp = DAMP;
  /* A body can be sent somewhere VIA waypoints: it springs to the first
     until its condition says so, then to the next, then on to its
     destination. That is how a box travels as a slender drop and only
     widens where it lands, how the bubble forms as a circle before it
     stretches into a pill — the film's body buds off round and fills out
     in place — and how it leaves: back to its circle, down to a bead,
     and up into the box it came from. */
  private dest = new Float64Array(5);
  private legs: Leg[] = [];
  private via: Float64Array | null = null;
  private until: ((s: Slot) => boolean) | null = null;

  snap(v: Vec5) {
    this.cur.set(v);
    this.tgt.set(v);
    this.dest.set(v);
    this.legs = [];
    this.via = null;
    this.vel.fill(0);
  }
  aim(v: Vec5, ...legs: Leg[]) {
    // Every hover change re-aims every body, so this is called far more
    // often than a destination changes. The same destination again keeps
    // whatever leg the body is on — whether it has passed its waypoints
    // or not — rather than starting the route over: sending a body that
    // had already arrived back through its waypoint is how the bubble's
    // exit came to play twice. And a waypoint is for a journey; a body
    // already close to a (slightly) new destination, such as one that
    // just swelled 4px on hover, goes straight there.
    if (this.dest.every((d, i) => d === v[i])) return;
    const close =
      Math.abs(this.cur[0] - v[0]) < 24 && Math.abs(this.cur[1] - v[1]) < 24;
    this.plan(v, close ? [] : legs);
  }
  /** As aim, but always through the waypoints — for a change of SHAPE
      where the body stands (the squeeze on shutting), which aim would take
      for no journey at all. */
  route(v: Vec5, ...legs: Leg[]) {
    if (this.dest.every((d, i) => d === v[i])) return;
    this.plan(v, legs);
  }
  private plan(v: Vec5, legs: Leg[]) {
    this.dest.set(v);
    this.legs = legs.slice();
    this.nextLeg();
  }
  /** Spring at the next waypoint, or at the destination when none is left. */
  private nextLeg() {
    const leg = this.legs.shift();
    if (leg) {
      this.via = new Float64Array(leg[0]);
      this.until = leg[1];
      this.tgt.set(this.via);
    } else {
      this.via = null;
      this.until = null;
      this.tgt.set(this.dest);
    }
  }
  /** At a waypoint whose condition now holds: take the next leg. True if
      there was one to take. */
  onward() {
    if (this.via && this.until && this.until(this)) {
      this.nextLeg();
      return true;
    }
    return false;
  }
  step(dt: number) {
    const { cur, vel, tgt } = this;
    this.onward();
    for (let i = 0; i < 5; i++) {
      vel[i] += (this.k * (tgt[i] - cur[i]) - this.damp * vel[i]) * dt;
      cur[i] += vel[i] * dt;
    }
    /* Size change counts as motion too, at half weight: a box swelling
       into a pill ripples like one travelling. */
    // Travel is what the TRAILING edge does: a body widening from an
    // anchored end (the bubble stretching into its pill) moves its centre
    // without going anywhere, and must not stretch or ripple like one in
    // flight. Growing symmetrically (the seed swelling) travels nothing.
    this.travel = Math.hypot(
      Math.max(0, Math.abs(vel[0]) - Math.abs(vel[2]) * 0.5),
      Math.max(0, Math.abs(vel[1]) - Math.abs(vel[3]) * 0.5)
    );
    this.speed = Math.hypot(vel[0], vel[1], vel[2] * 0.5, vel[3] * 0.5);
  }
  settled() {
    const { cur, vel, tgt } = this;
    for (let i = 0; i < 5; i++) {
      if (Math.abs(vel[i]) > 1.5 || Math.abs(tgt[i] - cur[i]) > 0.25) return false;
    }
    return true;
  }
  /** Within `tol` of the current spring target — the waypoint, while on
      the first leg. For waypoint conditions. */
  near(tol: number) {
    const { cur, tgt } = this;
    return (
      Math.abs(cur[0] - tgt[0]) < tol &&
      Math.abs(cur[1] - tgt[1]) < tol &&
      Math.abs(cur[2] - tgt[2]) < tol
    );
  }
  /** Near AND slow: the body has formed, not merely passed through. */
  home(tol: number, maxSpeed: number) {
    return this.near(tol) && this.speed < maxSpeed;
  }
  /** Within `tol` of the DESTINATION, past any waypoint — for content,
      which must not surface while the body pauses at its waypoint (the
      bubble's label used to flash on the bead). */
  arrived(tol: number, maxSpeed = Infinity) {
    return this.via === null && this.near(tol) && this.speed < maxSpeed;
  }
  /** Derive the field body: speed-driven stretch along the motion and
      skin waves, none of it at rest. */
  derive() {
    const { cur, vel, body } = this;
    const st = Math.min(0.3, this.travel * 0.0005);
    let w = Math.max(0, cur[2]);
    let h = Math.max(0, cur[3]);
    if (Math.abs(vel[0]) > Math.abs(vel[1])) {
      w *= 1 + st;
      h /= 1 + st * 0.5;
    } else {
      h *= 1 + st;
      w /= 1 + st * 0.5;
    }
    body.x = cur[0];
    body.y = cur[1];
    body.w = w;
    body.h = h;
    body.r = Math.max(0, cur[4]);
    // Waves run along a travelling skin; a body merely changing size
    // (the seed swelling, the bubble stretching) ripples far less, as the
    // film's stretch is smooth.
    body.wob = Math.min(1.2, this.travel * 0.002 + Math.hypot(vel[2], vel[3]) * 0.0005);
    body.s = S_REST + (S_FLOW - S_REST) * Math.min(1, this.speed / FULL_SPEED);
  }
}

type Which = "seed" | "cta" | "folder" | "ai";

interface DockEls {
  stage: HTMLDivElement;
  glass: HTMLDivElement;
  sil: SVGPathElement;
  seed: HTMLButtonElement;
  cta: HTMLAnchorElement;
  folder: HTMLDivElement;
  /** The folder's front, which swings open on click, and the inside it
      swings open on. */
  flap: HTMLDivElement;
  pocket: HTMLDivElement;
  ai: HTMLButtonElement;
  stamp: HTMLSpanElement;
  bubble: HTMLSpanElement;
  /** The joystick: the dot that stays home, the glyph that leans, and the
      colour bridge — its mask's line and disc, and the tinted rim. */
  homeDot: HTMLSpanElement;
  plus: HTMLSpanElement;
  bridgeLine: SVGLineElement;
  bridgeDot: SVGCircleElement;
  bridgeTint: SVGUseElement;
  /** The cube's canvas; absent when WebGL is unavailable. */
  cube: HTMLCanvasElement | null;
  /** The frosted skin under the cube, and its silhouette in the SVG. */
  cubeFrost: HTMLDivElement | null;
  cubeSil: SVGPathElement | null;
  /** Starts and stops the cube's drawing with its visibility. */
  cubeActive: ((on: boolean) => void) | null;
}

interface Intent {
  visible: boolean;
  open: boolean;
  hover: Which | null;
  press: Which | null;
  /** The AI slot is hovered (or was, within its linger): its bubble is out. */
  bubble: boolean;
  /** The folder is hovered: it is the envelope. */
  apart: boolean;
}

/**
 * The dock's motion, outside React: three spring-driven boxes, the field
 * that joins them, and a frame loop that runs only while something moves
 * and writes straight to the DOM — the clip-path on the glass, the shared
 * SVG path, each box's content transform, and the "content is home" flags.
 */
class DockSim {
  private readonly field: LiquidField;
  private readonly seed = new Slot();
  private readonly cta = new Slot();
  private readonly folder = new Slot();
  private readonly ai = new Slot();
  private readonly bubble = new Slot();
  /* The joystick's tail: a spring for its tip, and the beads laid between
     the + and the tip each frame, which the field fuses into one neck. */
  private readonly tail = new Slot();
  private readonly beads: FieldBody[] = Array.from({ length: BEADS }, () => ({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    r: 0,
    wob: 0,
    s: S_REST,
  }));
  private ptr: { x: number; y: number } | null = null;
  private ptrNear = false;
  private lit: Lit | null = null;
  private readonly bodies: FieldBody[];
  private readonly reduced: boolean;
  private readonly intent: Intent = {
    visible: false,
    open: false,
    hover: null,
    press: null,
    bubble: false,
    apart: false,
  };
  private raf = 0;
  private last = 0;
  private closeTimer = 0;
  private hideTimer = 0;
  private homeTimer = 0;
  /* Buttons waiting their beat to leave the + on opening. */
  private readonly delayed = new Set<Slot>();
  private readonly delayTimers: number[] = [];
  /* The + stands one step out of the corner while the pad is out, and
     until the buttons are gone after it shuts. */
  private seedOut = false;
  /* Whether the seed was there last frame — the sink's end is the moment
     it stops being, and that is when the pond closes over it. */
  private hadSeed = false;
  private lastOpen = false;
  private dead = false;

  constructor(
    private readonly els: DockEls,
    private readonly layout: Layout,
    private readonly bubbleW: number,
    /** The glass cube is live: the seed's field body is the small core. */
    private readonly cube: boolean,
    /** Called the moment the drop has sunk away: the pond closes. */
    private readonly onSunk: () => void
  ) {
    this.field = new LiquidField(layout.W, layout.H, 2);
    this.bodies = [
      this.seed.body,
      this.cta.body,
      this.folder.body,
      this.ai.body,
      this.bubble.body,
      this.tail.body,
      ...this.beads,
    ];
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const parked = this.parked();
    this.seed.snap(parked);
    this.cta.snap(parked);
    this.folder.snap(parked);
    this.ai.snap(parked);
    this.bubble.snap(parked);
    this.tail.snap(parked);
    this.tail.k = TAIL_K;
    this.tail.damp = 2 * Math.sqrt(TAIL_K) * TAIL_ZETA;
    this.retarget();
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.closeTimer);
    window.clearTimeout(this.hideTimer);
    window.clearTimeout(this.homeTimer);
    this.delayTimers.forEach((t) => window.clearTimeout(t));
  }

  /** Update any part of the intent and re-aim the springs. */
  set(patch: Partial<Intent>) {
    Object.assign(this.intent, patch);
    this.retarget();
  }

  /** The pointer, in stage px, or null when it has left the page. Only
      wakes the loop while the pointer is (or has just been) within reach,
      so a pointer moving about the rest of the page costs nothing. */
  pointer(p: { x: number; y: number } | null) {
    const near =
      !!p && Math.hypot(p.x - this.seed.cur[0], p.y - this.seed.cur[1]) < REACH_RANGE + 40;
    if (!near && !this.ptrNear) return;
    this.ptrNear = near;
    this.ptr = near ? p : null;
    this.wake();
  }

  /** Aim the tail's tip: onto the lit button's edge, or a share of the way
      to the pointer, or home. Every frame, since the pointer moves on its
      own time. */
  private reach() {
    const { visible, open, hover, press } = this.intent;
    const sx = this.seed.cur[0];
    const sy = this.seed.cur[1];
    const pick = (w: Which | null): Lit | null => (w && w !== "seed" ? w : null);
    const lit = open && visible ? pick(hover) ?? pick(press) : null;
    let tx = sx;
    let ty = sy;
    let len = 0;
    if (!this.reduced && lit) {
      const b = this.layout[lit];
      const dx = b.x - sx;
      const dy = b.y - sy;
      const d = Math.hypot(dx, dy) || 1;
      len = d - SEED / 2 + 4;
      tx = sx + (dx / d) * len;
      ty = sy + (dy / d) * len;
    } else if (!this.reduced && visible && this.ptr) {
      const dx = this.ptr.x - sx;
      const dy = this.ptr.y - sy;
      const d = Math.hypot(dx, dy);
      if (d > SEED / 2 && d < REACH_RANGE) {
        // Eases off towards the edge of the range, so the tail never snaps.
        const fade = Math.min(1, (REACH_RANGE - d) / (REACH_RANGE * 0.35));
        len = Math.min(REACH_MAX, (d - SEED / 2) * REACH_SHARE) * fade;
        tx = sx + (dx / d) * len;
        ty = sy + (dy / d) * len;
      }
    }
    const tip = len > 2 ? TAIL_END : 0;
    this.tail.aim([tx, ty, tip, tip, tip / 2]);
    this.lit = lit;
  }

  /** Lay the beads from the + to the tail's tip: thick at the root, the
      tip's size at the end, with a gentle S across the line — the film's
      bridge is a sinuous neck, not a rod. */
  private chain() {
    const sx = this.seed.cur[0];
    const sy = this.seed.cur[1];
    const dx = this.tail.cur[0] - sx;
    const dy = this.tail.cur[1] - sy;
    const d = Math.hypot(dx, dy);
    const on =
      Math.min(1, Math.max(0, (d - 6) / 18)) *
      Math.min(1, Math.max(0, this.tail.cur[2]) / TAIL_END);
    const nx = d > 0 ? -dy / d : 0;
    const ny = d > 0 ? dx / d : 0;
    const bend = Math.min(4, d * 0.06);
    const s = Math.max(S_REST + 2, this.tail.body.s);
    for (let i = 0; i < BEADS; i++) {
      const u = (i + 1) / (BEADS + 1);
      const size = (TAIL_ROOT + (TAIL_END - TAIL_ROOT) * u) * on;
      const sway = Math.sin(u * Math.PI * 2) * bend;
      const b = this.beads[i];
      b.x = sx + dx * u + nx * sway;
      b.y = sy + dy * u + ny * sway;
      b.w = size;
      b.h = size;
      b.r = size / 2;
      b.wob = 0;
      b.s = s;
    }
  }

  /* The seed's parking spot: its own centre, at no size. The drop rises
     out of that point when the corner is hovered, the way a stone in a
     pond throws one up, and sinks back into it on hide. */
  private parked(): Vec5 {
    const at = this.seedOut ? this.layout.seedOut : this.layout.seed;
    return [at.x, at.y, 0, 0, 0];
  }

  private retarget() {
    const L = this.layout;
    const { visible, open, hover, press } = this.intent;
    const bump = (which: Which) =>
      (hover === which ? SWELL : 0) + (press === which ? PRESS : 0);

    // Opening sends the + out of the corner at once; shutting keeps it out
    // until the buttons have squeezed away, then lets it glide home.
    if (open) {
      window.clearTimeout(this.homeTimer);
      this.homeTimer = 0;
      this.seedOut = true;
    } else if (this.lastOpen) {
      window.clearTimeout(this.homeTimer);
      this.homeTimer = window.setTimeout(() => {
        this.homeTimer = 0;
        this.seedOut = false;
        this.retarget();
      }, HOME_DELAY_MS);
    }
    const seedPos = this.seedOut ? L.seedOut : L.seed;
    // A small core swells less, or the cube would balloon on hover.
    const size = this.cube ? CORE + bump("seed") * 0.5 : SEED + bump("seed");
    const seedAt: Vec5 = visible
      ? [seedPos.x, seedPos.y, size, size, this.cube ? CORE_R : BOX_R]
      : this.parked();
    if (visible) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = 0;
      this.seed.aim(seedAt);
    } else if (this.seed.tgt[2] > 0 && !this.hideTimer) {
      // Just hidden: the + gets its beat to dive, then the drop sinks. A
      // hover or press arriving during the beat must not cut it short.
      this.hideTimer = window.setTimeout(() => {
        this.hideTimer = 0;
        this.seed.aim(seedAt);
        this.wake();
      }, HIDE_DELAY_MS);
    } else if (!this.hideTimer) {
      this.seed.aim(seedAt);
    }

    // The pad's buttons are round, the seed's size. The folder is round too
    // until it is hovered — then it is the envelope: taller than wide,
    // tighter corners.
    const round = (at: { x: number; y: number }, which: Which): Vec5 => {
      const d = SEED + bump(which);
      return [at.x, at.y, d, d, d / 2];
    };
    const { apart } = this.intent;
    const folderAt: Vec5 = apart
      ? [
          L.folder.x,
          L.folder.y,
          FOLDER_W + bump("folder") * 0.5,
          FOLDER_H + bump("folder") * 0.5,
          FOLDER_R,
        ]
      : round(L.folder, "folder");
    // In the film's order: left, top, right.
    const buttons: [Slot, Vec5, number][] = [
      [this.folder, folderAt, 0],
      [this.ai, round(L.ai, "ai"), TOP_DELAY_MS],
      [this.cta, round(L.cta, "cta"), RIGHT_DELAY_MS],
    ];
    // A button that squeezed away last time still stands, at no size, where
    // it was: it is born again inside the +, wherever the + is now, so it
    // buds off it.
    const bud = (slot: Slot, at: Vec5) => {
      if (slot.cur[2] < 1 && slot.cur[3] < 1) {
        slot.snap([this.seed.cur[0], this.seed.cur[1], 0, 0, 0]);
      }
      slot.aim(at);
    };
    if (open) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = 0;
      if (!this.lastOpen) {
        const glide = L.seedOut.x !== L.seed.x || L.seedOut.y !== L.seed.y ? GLIDE_FIRST_MS : 0;
        for (const [slot, at, delay] of buttons) {
          const wait = glide + delay;
          if (wait === 0) {
            bud(slot, at);
            continue;
          }
          this.delayed.add(slot);
          this.delayTimers.push(
            window.setTimeout(() => {
              this.delayed.delete(slot);
              this.retarget();
            }, wait)
          );
        }
      } else {
        for (const [slot, at] of buttons) if (!this.delayed.has(slot)) bud(slot, at);
      }
    } else {
      this.delayTimers.forEach((t) => window.clearTimeout(t));
      this.delayTimers.length = 0;
      this.delayed.clear();
      // Shut: the content gets its beat to dissolve, then each button
      // squeezes to a thin upright oval where it stands and is gone. A hover
      // or press arriving during the beat must not cut it short.
      if (this.lastOpen) {
        window.clearTimeout(this.closeTimer);
        this.closeTimer = window.setTimeout(() => {
          this.closeTimer = 0;
          for (const [slot] of buttons) {
            if (slot.cur[2] < 1 && slot.cur[3] < 1) continue;
            const x = slot.cur[0];
            const y = slot.cur[1];
            slot.route(
              [x, y, 0, 0, 0],
              [[x, y, SQUEEZE_W, SQUEEZE_H, SQUEEZE_W / 2], (b) => b.cur[2] < SQUEEZE_W + 4]
            );
          }
          this.wake();
        }, CLOSE_DELAY_MS);
      }
    }
    this.lastOpen = open;

    // The bubble. Out: born at the AI button's centre, it rises out of the
    // button's top as a bead, forms a proper CIRCLE above it, stills, and
    // only then stretches out both ways into its pill: the film's
    // circle-then-pill. In: the same road back — the pill draws back into
    // its circle, the circle shrinks to a bead, and the bead sinks back
    // into the button and is taken in. The client wants it plain that the
    // words come out of that button and go back into it. Shut, it squeezes
    // away where it is, with the buttons.
    const circle: Vec5 = [L.bubble.x, L.bubble.y, BUBBLE_H, BUBBLE_H, BUBBLE_H / 2];
    const bead: Vec5 = [circle[0], circle[1], BEAD, BEAD, BEAD / 2];
    // The bead sitting on the top of the button, a hair into it, so the goo
    // necks it to the button: where the bubble is seen to come out, and
    // where it is seen to go back in.
    const lip: Vec5 = [L.ai.x, L.ai.y - SEED / 2 - BEAD / 2 + 3, BEAD, BEAD, BEAD / 2];
    const formed = (b: Slot) => b.home(3, 120);
    const beaded = (b: Slot) => b.near(2.5);
    // Near AND slow: the drop sits on the button for a beat — long enough
    // to be seen coming out of it, or going into it — before it rises or
    // is drawn in.
    const atLip = (b: Slot) => b.home(2.5, 40);
    const inButton: Vec5 = [L.ai.x, L.ai.y, 0, 0, 0];
    if (open && this.intent.bubble) {
      if (this.bubble.cur[2] < 1 && this.bubble.cur[3] < 1) this.bubble.snap(inButton);
      this.bubble.aim(
        [L.bubble.x, L.bubble.y, this.bubbleW, BUBBLE_H, BUBBLE_H / 2],
        [lip, atLip],
        [circle, formed]
      );
    } else if (!open) {
      this.bubble.aim([this.bubble.cur[0], this.bubble.cur[1], 0, 0, 0]);
    } else {
      // How much of the road back there is depends on how far out the
      // bubble got: a pill goes back through its circle, its bead and the
      // button's lip; a circle or a bead still forming goes to the bead and
      // down; a bead still on its way out just turns round.
      const w = this.bubble.cur[2];
      if (w > BUBBLE_H + 6) {
        this.bubble.aim(inButton, [circle, formed], [bead, beaded], [lip, atLip]);
      } else if (w > BEAD + 4) {
        this.bubble.aim(inButton, [bead, beaded], [lip, atLip]);
      } else {
        this.bubble.aim(inButton, [lip, atLip]);
      }
    }
    this.wake();
  }

  private wake() {
    if (this.dead || this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number) => {
    this.raf = 0;
    if (this.dead) return;
    const dt = Math.min(0.034, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.reach();
    const slots = [this.seed, this.cta, this.folder, this.ai, this.bubble, this.tail];
    let settled = true;
    for (const slot of slots) {
      if (this.reduced) {
        slot.cur.set(slot.tgt);
        slot.vel.fill(0);
        slot.speed = 0;
        slot.travel = 0;
      } else {
        slot.step(dt);
      }
      if (!slot.settled()) settled = false;
      slot.derive();
    }
    // For the stylesheet: on phones the shadow steps aside while the bodies
    // move (see .is-moving in corner-dock.css).
    this.els.stage.classList.toggle("is-moving", !settled);
    this.inherit();
    this.chain();
    // The cube stands in for the seed: keep its spring, paint no body.
    if (this.cube) this.seed.body.w = 0;
    // The sink: the seed gone after being there. The pond closes.
    const seedOn = this.seed.cur[2] > 0.5;
    if (this.hadSeed && !seedOn) this.onSunk();
    this.hadSeed = seedOn;
    if (settled) {
      for (const slot of slots) {
        slot.cur.set(slot.tgt);
        slot.vel.fill(0);
        slot.speed = 0;
        slot.travel = 0;
        slot.derive();
      }
      this.chain();
      if (this.cube) this.seed.body.w = 0;
      // A body resting at its waypoint is not done: send it on.
      if (slots.some((slot) => slot.onward())) {
        this.raf = requestAnimationFrame(this.tick);
        return;
      }
      // Away and still: paint nothing, so nothing is composited while the
      // dock waits.
      const { visible, open } = this.intent;
      this.paint(visible || open ? this.field.path(this.bodies, now / 1000) : "");
      this.ride();
      return;
    }
    this.paint(this.field.path(this.bodies, now / 1000));
    this.ride();
    this.raf = requestAnimationFrame(this.tick);
  };

  /** A parent reaches as far as the bud leaving it: the seed for the two
      boxes, the tools box for its bubble. Own speeds only, so the boost
      does not travel up two generations. */
  private inherit() {
    const own = (slot: Slot) => S_REST + (S_FLOW - S_REST) * Math.min(1, slot.speed / FULL_SPEED);
    this.seed.body.s = Math.max(
      own(this.seed),
      own(this.cta),
      own(this.folder),
      own(this.ai),
      own(this.tail)
    );
    this.ai.body.s = Math.max(own(this.ai), own(this.bubble));
  }

  private paint(d: string) {
    const { glass, sil, stage } = this.els;
    glass.style.clipPath = d ? `path("${d}")` : 'path("M-9 -9Z")';
    sil.setAttribute("d", d || "M-9 -9");
    stage.classList.toggle("is-glass", d.length > 0);
  }

  /** Content rides its body, and surfaces once the body is (nearly) home. */
  private ride() {
    const {
      seed,
      cta,
      folder,
      flap,
      pocket,
      ai,
      stamp,
      bubble,
      homeDot,
      plus,
      bridgeLine,
      bridgeDot,
      bridgeTint,
      cube,
      cubeFrost,
      cubeSil,
    } = this.els;
    const seedB = this.seed.body;
    const ctaB = this.cta.body;
    const folderB = this.folder.body;
    const aiB = this.ai.body;
    const bubbleB = this.bubble.body;
    const at = (el: HTMLElement, x: number, y: number) => {
      el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    };
    at(seed, seedB.x - SEED / 2, seedB.y - SEED / 2);
    // The joystick: the glyph leans after the tail's tip, a few px at most,
    // and the dot at the centre stays home — shown only while they part.
    const lx = this.tail.cur[0] - seedB.x;
    const ly = this.tail.cur[1] - seedB.y;
    const ld = Math.hypot(lx, ly);
    const lean = ld > 0 ? Math.min(GLYPH_LEAN, ld * 0.12) / ld : 0;
    plus.style.translate = `${(lx * lean).toFixed(2)}px ${(ly * lean).toFixed(2)}px`;
    at(homeDot, seedB.x - 1.5, seedB.y - 1.5);
    const parted = ld > 6 ? "1" : "0";
    if (homeDot.style.opacity !== parted) homeDot.style.opacity = parted;
    if (cube) {
      const k = Math.max(0, this.seed.cur[2]) / (this.cube ? CORE : SEED);
      const x = seedB.x - CUBE_PX / 2;
      const y = seedB.y - CUBE_PX / 2;
      const tf = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${k.toFixed(3)})`;
      cube.style.transform = tf;
      const on = k > 0.02;
      cube.style.visibility = on ? "visible" : "hidden";
      if (cubeFrost) {
        cubeFrost.style.transform = tf;
        cubeFrost.style.visibility = on ? "visible" : "hidden";
      }
      // The SVG silhouette scales about the canvas's centre, as the CSS does.
      cubeSil?.setAttribute(
        "transform",
        `translate(${(x + CUBE_PX / 2).toFixed(2)} ${(y + CUBE_PX / 2).toFixed(2)}) scale(${k.toFixed(
          3
        )}) translate(${-CUBE_PX / 2} ${-CUBE_PX / 2})`
      );
      this.els.cubeActive?.(on);
    }
    at(cta, ctaB.x - SEED / 2, ctaB.y - SEED / 2);
    at(ai, aiB.x - SEED / 2, aiB.y - SEED / 2);
    // The folder slot fills the folder's body — round at rest, the envelope
    // while hovered — and its front (the flap) and inside (the pocket) sit
    // over it, sized with it.
    const fw = Math.max(0, this.folder.cur[2]);
    const fh = Math.max(0, this.folder.cur[3]);
    const fr = Math.max(0, this.folder.cur[4]);
    const fx = folderB.x - fw / 2;
    const fy = folderB.y - fh / 2;
    at(folder, fx, fy);
    folder.style.width = `${fw.toFixed(2)}px`;
    folder.style.height = `${fh.toFixed(2)}px`;
    folder.style.borderRadius = `${fr.toFixed(2)}px`;
    // The flap keeps its transform for the swing, so it is placed by
    // left/top instead.
    flap.style.left = `${fx.toFixed(2)}px`;
    flap.style.top = `${fy.toFixed(2)}px`;
    flap.style.width = folder.style.width;
    flap.style.height = folder.style.height;
    flap.style.borderRadius = folder.style.borderRadius;
    at(pocket, fx, fy);
    pocket.style.width = folder.style.width;
    pocket.style.height = folder.style.height;
    pocket.style.borderRadius = folder.style.borderRadius;
    at(bubble, bubbleB.x - this.bubbleW / 2, bubbleB.y - BUBBLE_H / 2);
    // The stamps sit dead centre in the folder.
    at(stamp, folderB.x - STAMP_W / 2, folderB.y - STAMP_H / 2);

    // The colour bridge: the rim re-drawn in the lit button's colour, masked
    // to the reach from the × to that button and the button's own rim; the
    // button glows with it. Left in place when it goes out, so it fades
    // where it was.
    const lit = this.lit;
    if (lit) {
      const b = this.layout[lit];
      bridgeLine.setAttribute("x1", seedB.x.toFixed(1));
      bridgeLine.setAttribute("y1", seedB.y.toFixed(1));
      bridgeLine.setAttribute("x2", b.x.toFixed(1));
      bridgeLine.setAttribute("y2", b.y.toFixed(1));
      bridgeDot.setAttribute("cx", b.x.toFixed(1));
      bridgeDot.setAttribute("cy", b.y.toFixed(1));
      bridgeTint.style.color = HOT_COLOR[lit];
    }
    const tintOn = lit ? "1" : "0";
    if (bridgeTint.style.opacity !== tintOn) bridgeTint.style.opacity = tintOn;
    cta.classList.toggle("is-hot", lit === "cta");
    folder.classList.toggle("is-hot", lit === "folder");
    ai.classList.toggle("is-hot", lit === "ai");

    const { visible, open } = this.intent;
    const flag = (el: HTMLElement, on: boolean) => {
      const v = on ? "1" : "0";
      if (el.dataset.in !== v) el.dataset.in = v;
    };
    // The + pops up only once the drop has formed and stilled — near its
    // size AND slow, or it would fire on the way up through the overshoot.
    flag(seed, visible && this.seed.arrived(4, 90));
    flag(cta, open && this.cta.arrived(9));
    const folderIn = open && this.folder.arrived(9);
    flag(folder, folderIn);
    stamp.classList.toggle("is-in", folderIn);
    flag(ai, open && this.ai.arrived(9));
    flag(bubble, open && this.intent.bubble && this.bubble.arrived(9));
  }
}

/**
 * Corner glass dock. What the visitor sees first is a very small RIPPLE
 * welling out of the bottom-right corner on a steady beat (see the timing
 * constants). Hover the corner and the + box slides in off the edge of
 * the screen; click it and three round buttons bud off it, liquid-glass
 * fashion, and stand round it like a game pad's face buttons — the stamp
 * folder left, the AI doorway on top, start-a-project right — while the
 * + turns into a × and stays. The glass is one clipped sheet whose
 * outline is a metaball field of the boxes, recomputed per frame while
 * anything moves (liquidField.ts); the CSS holds the appearance rules.
 */
export default function CornerGlassDock() {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);
  // The corner is being hovered (or was, within HOT_LINGER_MS): the + is
  // out. Both the corner zone and the dock itself feed this, so moving from
  // the ripple onto the + keeps it hot.
  const [hot, setHot] = useState(false);
  // Clicked once: the dock has earned its place and the + stays out.
  const [engaged, setEngaged] = useState(false);
  // The corner has rivals — the hero and footer pin their own "Let's Talk"
  // CTAs there, and on the phone layout the services section's Expand
  // button lands there too. Any element tagged data-corner-dock-avoid
  // that's in the viewport suppresses the dock, so it never sits on top of
  // one. The tag's value may be a media query the rival only counts under
  // (the Expand button: "(max-width: 600px)", the rule that moves it to the
  // corner), so a rival can be one on a phone and not on a desktop.
  const [clear, setClear] = useState(true);
  // The stamps are being coaxed out of their folder.
  const [stampHot, setStampHot] = useState(false);
  // The folder's front: open on a click, shut when the box is left or the
  // dock shuts.
  const [folderOpen, setFolderOpen] = useState(false);
  const stampTimer = useRef(0);
  // On touch the reveals are TAP-TOGGLED, not timed: the client (19 Sep)
  // wants a phone user able to look at the stamps and the bubble for as
  // long as they like. A tap shows them; the next tap, or the dock
  // shutting, hides them. These remember which is showing.
  const touchApart = useRef(false);
  const touchBubble = useRef(false);
  useEffect(() => () => window.clearTimeout(stampTimer.current), []);
  // Counts the drop's sinkings; each one closes the pond with a ring (the
  // key restarts the animation).
  const [splash, setSplash] = useState(0);
  // The bubble's width comes from its label; measured, then the stage is
  // laid out around it.
  const [bubbleW, setBubbleW] = useState(0);
  // The phone pad (see PHONE_TOP). False on the server and through
  // hydration so the markup matches, then the device's answer; the dock is
  // still hidden at that point, so the relayout is never seen.
  const phone = useSyncExternalStore(noopSubscribe, isPhoneDevice, () => false);

  // Refs mirror state for the timer chain, which outlives any one render.
  const openRef = useRef(false);
  const engagedRef = useRef(false);

  useEffect(() => {
    const rivals = document.querySelectorAll<HTMLElement>("[data-corner-dock-avoid]");
    if (rivals.length === 0) return;
    const onScreen = new Set<Element>();
    const scope = new Map<Element, MediaQueryList>();
    for (const el of rivals) {
      // A bare JSX attribute arrives as "true"; only a query counts as one.
      const q = el.getAttribute("data-corner-dock-avoid")?.trim() ?? "";
      if (q.startsWith("(")) scope.set(el, window.matchMedia(q));
    }
    const counts = (el: Element) => scope.get(el)?.matches ?? true;
    const settle = () => {
      let blocked = false;
      for (const el of onScreen) if (counts(el)) blocked = true;
      setClear(!blocked);
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) onScreen.add(e.target);
        else onScreen.delete(e.target);
      }
      settle();
    });
    rivals.forEach((el) => io.observe(el));
    // A rival can start or stop counting on a resize (a window narrowed to
    // the phone layout, a phone turned) without moving on screen.
    for (const mql of scope.values()) mql.addEventListener("change", settle);
    return () => {
      io.disconnect();
      for (const mql of scope.values()) mql.removeEventListener("change", settle);
    };
  }, []);

  useEffect(() => {
    let timer = 0;
    const start = () => {
      timer = window.setTimeout(() => setShown(true), FIRST_DELAY_MS);
    };

    // Wait for the loading screen's hand-off, same as the hero does.
    if ((window as Window & { __appRevealed?: boolean }).__appRevealed) {
      start();
    } else {
      window.addEventListener("app:reveal", start, { once: true });
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("app:reveal", start);
    };
  }, []);

  const hotTimer = useRef(0);
  const heat = useCallback(() => {
    window.clearTimeout(hotTimer.current);
    setHot(true);
  }, []);
  const cool = useCallback(() => {
    window.clearTimeout(hotTimer.current);
    hotTimer.current = window.setTimeout(() => setHot(false), HOT_LINGER_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(hotTimer.current), []);

  const toggle = useCallback(() => {
    engagedRef.current = true;
    setEngaged(true);
    // The dock shutting (or opening afresh) shuts the folder too.
    setFolderOpen(false);
    setOpen((v) => {
      openRef.current = !v;
      return !v;
    });
  }, []);

  // Escape collapses the boxes back into the +.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        openRef.current = false;
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // The + is out while the corner is hot or the dock has been used; open,
  // it stays even over a rival — the user asked for it. The beacon beats
  // whenever the corner is clear and the dock is shut.
  const visible = open || ((hot || engaged) && clear);
  const rippling = shown && clear && !open;

  // ── The pond ──
  // The corner ripple is the page's own click ripple: the water layer's
  // splash (FluidCursor's wave simulation, lit white and crimson, spreading
  // across the page from the point), fired from the seed's centre through
  // the same app:splash event the gallery expands use, at the corner
  // preset — the water's widest train, for emphasis. It replaces a
  // displacement filter in a small box about the seed, which bent the
  // page's pixels the way the click's other half does but never looked
  // like the water; the client: "it doesn't match the ripple effect of
  // water which is on the whole body ... I need that same ripple here".
  // The rings in the markup are the fallback where the water is not
  // running (no float render targets, a lost context before it mounted);
  // `waterOk` decides which plays. The water mounts late — at idle time,
  // behind a dynamic import — so it is read from its marker if it is already
  // up, and heard from its app:water-ready event if it comes up later.
  const [waterOk, setWaterOk] = useState(
    () =>
      typeof document !== "undefined" &&
      !!document.querySelector("canvas[data-fluid-cursor]"),
  );
  // …and heard going down: a lost context swallows every splash, and the
  // dock kept firing into it while believing the water was up.
  useEffect(() => {
    const up = () => setWaterOk(true);
    const down = () => setWaterOk(false);
    window.addEventListener("app:water-ready", up);
    window.addEventListener("app:water-lost", down);
    return () => {
      window.removeEventListener("app:water-ready", up);
      window.removeEventListener("app:water-lost", down);
    };
  }, []);

  /* ── DOM the frame loop writes to ── */
  const stageRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const silRef = useRef<SVGPathElement>(null);
  // The chrome gradient turns on the SVG's own (SMIL) timeline, which the
  // menu-open CSS pause cannot reach: it is stopped here while the menu
  // covers the dock, and resumed where it was. Traced with the menu open,
  // it was rewriting the gradient's transform every frame under the veil.
  const defsSvgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = defsSvgRef.current;
    if (!svg) return;
    const pause = () => svg.pauseAnimations();
    const resume = () => svg.unpauseAnimations();
    if (document.body.classList.contains("menu-open")) pause();
    window.addEventListener("app:menu-open", pause);
    window.addEventListener("app:menu-close", resume);
    return () => {
      window.removeEventListener("app:menu-open", pause);
      window.removeEventListener("app:menu-close", resume);
    };
  }, []);
  const seedRef = useRef<HTMLButtonElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const folderRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const pocketRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<HTMLButtonElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const homeDotRef = useRef<HTMLSpanElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);
  const bridgeLineRef = useRef<SVGLineElement>(null);
  const bridgeDotRef = useRef<SVGCircleElement>(null);
  const bridgeTintRef = useRef<SVGUseElement>(null);
  const cubeRef = useRef<HTMLCanvasElement>(null);
  const cubeFrostRef = useRef<HTMLDivElement>(null);
  const cubeSilRef = useRef<SVGPathElement>(null);
  const shadowBlurRef = useRef<SVGFEGaussianBlurElement>(null);
  useEffect(() => {
    // Set after mount, not in the markup: the server renders the desktop
    // value and the attribute must hydrate as rendered.
    if (isPhoneDevice()) shadowBlurRef.current?.setAttribute("stdDeviation", "5");
  }, []);
  // The cube's lean towards the pointer; set once the cube is live.
  const cubeTilt = useRef<((x: number, y: number) => void) | null>(null);

  // Measure the pill and the bubble; again once the fonts are in, which
  // can widen them.
  useLayoutEffect(() => {
    const measure = () => {
      if (bubbleRef.current) setBubbleW(Math.ceil(bubbleRef.current.offsetWidth));
    };
    measure();
    document.fonts?.ready.then(measure);
  }, []);

  /* ── The simulation ──
     A DockSim owns the springs, the field and the frame loop, and writes
     straight to the DOM; React only hands it intent. Rebuilt when the
     layout changes (the bubble's width). */
  const simRef = useRef<DockSim | null>(null);
  useEffect(() => {
    if (!bubbleW) return;
    const els = {
      stage: stageRef.current,
      glass: glassRef.current,
      sil: silRef.current,
      seed: seedRef.current,
      cta: ctaRef.current,
      folder: folderRef.current,
      flap: flapRef.current,
      pocket: pocketRef.current,
      ai: aiRef.current,
      stamp: stampRef.current,
      bubble: bubbleRef.current,
      homeDot: homeDotRef.current,
      plus: plusRef.current,
      bridgeLine: bridgeLineRef.current,
      bridgeDot: bridgeDotRef.current,
      bridgeTint: bridgeTintRef.current,
    };
    if (Object.values(els).some((el) => !el)) return;
    // The glass cube, drawn through the rims' shared WebGL context. If
    // that is not to be had, the seed stays the flat frosted box.
    const canvas = cubeRef.current;
    // The cube's silhouette, traced from its alpha after every blit, clips
    // the frosted skin under it and casts its shadow.
    const tracer = new LiquidField(CUBE_PX, CUBE_PX, 1);
    const onBlit = (ctx: CanvasRenderingContext2D, px: number) => {
      const data = ctx.getImageData(0, 0, px, px).data;
      const s = px / CUBE_PX;
      // Inside where the alpha clears a low bar: the faces let most of
      // the page through, so the shader keeps a floor of 0.1 for this.
      const d = tracer.pathOf((x, y) => {
        const ix = Math.min(px - 1, Math.round(x * s));
        const iy = Math.min(px - 1, Math.round(y * s));
        return 12 - data[(iy * px + ix) * 4 + 3];
      });
      if (cubeFrostRef.current) {
        cubeFrostRef.current.style.clipPath = d ? `path("${d}")` : 'path("M-9 -9Z")';
      }
      cubeSilRef.current?.setAttribute("d", d || "M-9 -9");
    };
    const glass = canvas
      ? subscribeGlassCube(
          canvas,
          () => CUBE_PX * Math.min(window.devicePixelRatio || 1, 2),
          onBlit
        )
      : null;
    cubeTilt.current = glass ? glass.tilt : null;
    if (canvas) canvas.hidden = !glass;
    if (cubeFrostRef.current) cubeFrostRef.current.hidden = !glass;
    const sim = new DockSim(
      {
        ...els,
        cube: glass ? canvas : null,
        cubeFrost: glass ? cubeFrostRef.current : null,
        cubeSil: glass ? cubeSilRef.current : null,
        cubeActive: glass ? glass.setActive : null,
      } as DockEls,
      layoutFor(bubbleW, phone),
      bubbleW,
      !!glass,
      () => setSplash((n) => n + 1)
    );
    simRef.current = sim;
    return () => {
      sim.destroy();
      glass?.stop();
      cubeTilt.current = null;
      simRef.current = null;
    };
  }, [bubbleW, phone]);

  // The cube leans towards the pointer over the seed, and rights itself
  // when it leaves.
  const leanTo = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    cubeTilt.current?.(
      ((e.clientX - r.left) / r.width - 0.5) * 2,
      ((e.clientY - r.top) / r.height - 0.5) * 2
    );
  }, []);
  const leanOff = useCallback(() => cubeTilt.current?.(0, 0), []);

  // React's intent → the springs.
  useEffect(() => {
    simRef.current?.set({ visible, open });
  }, [bubbleW, visible, open]);

  // The joystick's pointer. The stage is fixed to the corner, so its place
  // is measured once (and on resize) rather than read on every move — a
  // layout read per pointermove across the whole page is what the work
  // strip's frame budget was lost to. Mouse and pen only: a finger panning
  // the page past the corner is not reaching for the dock.
  useEffect(() => {
    let box: { x: number; y: number } | null = null;
    const measure = () => {
      const r = stageRef.current?.getBoundingClientRect();
      box = r ? { x: r.left, y: r.top } : null;
    };
    measure();
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !box) return;
      simRef.current?.pointer({ x: e.clientX - box.x, y: e.clientY - box.y });
    };
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) simRef.current?.pointer(null);
    };
    window.addEventListener("resize", measure);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
    };
  }, [bubbleW]);

  // The AI slot's bubble: out while the slot is hovered, lingering a beat
  // after the pointer leaves; a tap (touch has no hover) holds it out for
  // a couple of seconds.
  const bubbleTimer = useRef(0);
  const bubbleOn = useCallback(() => {
    window.clearTimeout(bubbleTimer.current);
    simRef.current?.set({ bubble: true });
  }, []);
  const bubbleOff = useCallback((after: number) => {
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(
      () => simRef.current?.set({ bubble: false }),
      after
    );
  }, []);
  useEffect(() => () => window.clearTimeout(bubbleTimer.current), []);

  const hoverOn = useCallback(
    (which: Which) => () => {
      heat();
      simRef.current?.set({ hover: which });
    },
    [heat]
  );
  const hoverOff = useCallback(() => {
    cool();
    simRef.current?.set({ hover: null, press: null });
  }, [cool]);
  const pressOn = useCallback(
    (which: Which) => () => simRef.current?.set({ press: which }),
    []
  );
  const pressOff = useCallback(() => simRef.current?.set({ press: null }), []);

  // The folder is the envelope while the pointer is over it, and round
  // again a beat after it leaves; a tap holds it a while on touch.
  const apartTimer = useRef(0);
  const apartOn = useCallback(() => {
    window.clearTimeout(apartTimer.current);
    simRef.current?.set({ apart: true });
  }, []);
  const apartOff = useCallback((after: number) => {
    window.clearTimeout(apartTimer.current);
    apartTimer.current = window.setTimeout(() => {
      simRef.current?.set({ apart: false });
      setFolderOpen(false);
    }, after);
  }, []);
  // The dock shutting takes the tap-held stamps and bubble with it (touch;
  // see touchApart / touchBubble).
  useEffect(() => {
    if (open || !(touchApart.current || touchBubble.current)) return;
    touchApart.current = false;
    touchBubble.current = false;
    window.clearTimeout(stampTimer.current);
    setStampHot(false);
    simRef.current?.set({ apart: false, bubble: false });
  }, [open]);
  useEffect(() => () => window.clearTimeout(apartTimer.current), []);

  const L = layoutFor(Math.max(bubbleW, 1), phone);
  const sx = L.seed.x;
  const sy = L.seed.y;

  // Where the seed's centre is on screen: the SVG's box maps 1:1 onto its
  // viewBox, so scale the seed's layout coordinates by what the box measures.
  // Read at each firing, not per frame — the stage drifts on its levitation.
  const rippleSvgRef = useRef<SVGSVGElement>(null);
  const svgW = L.W;
  const pondOrigin = useCallback((): [number, number] | null => {
    const svg = rippleSvgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (r.width < 1) return null;
    const k = r.width / svgW;
    return [r.left + sx * k, r.top + sy * k];
  }, [svgW, sx, sy]);

  // One splash from the seed's centre, into the water.
  const splashWater = useCallback(() => {
    const at = pondOrigin();
    if (!at) return;
    window.dispatchEvent(
      new CustomEvent("app:splash", {
        detail: { x: at[0], y: at[1], kind: "corner" },
      }),
    );
  }, [pondOrigin]);

  // The white wave: one ring growing out from inside the + and fading as it
  // clears the box. The client asked for it on top of the water — "one small
  // white ripple wave coming from the inner to make it more obvious there is
  // an expandable button there" — and it is also what makes the beacon
  // dependable: it needs no WebGL, so it plays where the water is not
  // running, has been evicted, or is too faint over a pale background to see.
  // Played through the Web Animations API on a plain element: no re-render
  // per beat, and no SVG transform-origin for Safari to misplace.
  const beaconRef = useRef<HTMLSpanElement>(null);
  const pulseBeacon = useCallback(() => {
    const el = beaconRef.current;
    if (!el || typeof el.animate !== "function") return;
    el.animate(
      [
        { width: "12px", height: "12px", opacity: 0 },
        { opacity: 0.95, offset: 0.12 },
        { width: "150px", height: "150px", opacity: 0 },
      ],
      { duration: 1500, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
    );
  }, []);

  // The beat: the white wave, and a splash into the water where it runs.
  // Not under the menu (the corner is covered and the pass would be wasted),
  // not in a hidden tab, not under reduced motion.
  useEffect(() => {
    if (!rippling) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fire = () => {
      if (document.hidden || document.body.classList.contains("menu-open")) return;
      pulseBeacon();
      if (waterOk) splashWater();
    };
    fire();
    const iv = window.setInterval(fire, BEAT_MS);
    return () => window.clearInterval(iv);
  }, [rippling, waterOk, splashWater, pulseBeacon]);

  // The pond closing over a sunk drop: the same splash, once.
  useEffect(() => {
    if (splash === 0 || !waterOk) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    splashWater();
  }, [splash, waterOk, splashWater]);

  return (
    <>
      {/* The hover zone round the box's place. Touch has no hover, so a
          tap there does the same as hovering it. */}
      <div
        aria-hidden
        className={`cgd-corner ${clear ? "is-live" : ""}`}
        onPointerEnter={heat}
        onPointerDown={heat}
        onPointerLeave={cool}
      />
      <div
        ref={stageRef}
        className={`cgd-stage ${open ? "is-open" : ""}`}
        style={{ width: L.W, height: L.H }}
      >
        {/* Beneath the glass: the silhouette's definitions and its shadow. */}
        <svg
          ref={defsSvgRef}
          aria-hidden
          className="cgd-svg"
          width={L.W}
          height={L.H}
          viewBox={`0 0 ${L.W} ${L.H}`}
        >
          <defs>
            <path id="cgd-sil" ref={silRef} d="M-9 -9" />
            <clipPath id="cgd-clip">
              <use href="#cgd-sil" />
            </clipPath>
            {/* The chrome rim (see .liquid-glass::before in globals.css): the
                same bands, as a gradient that turns about the stage once
                every 8s, so the reflections flow round every body's edge.
                Repeats along its length so a long body gets several. */}
            <linearGradient
              id="cgd-chrome"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="220"
              y2="0"
              spreadMethod="repeat"
            >
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.08" stopColor="#a3aab5" />
              <stop offset="0.11" stopColor="#ffb37c" />
              <stop offset="0.13" stopColor="#17191e" />
              <stop offset="0.15" stopColor="#82bbff" />
              <stop offset="0.2" stopColor="#f3f6fa" />
              <stop offset="0.36" stopColor="#ffffff" />
              <stop offset="0.42" stopColor="#6a717c" />
              <stop offset="0.44" stopColor="#ffc999" />
              <stop offset="0.46" stopColor="#1e2126" />
              <stop offset="0.48" stopColor="#9ccbff" />
              <stop offset="0.54" stopColor="#ffffff" />
              <stop offset="0.7" stopColor="#eef1f5" />
              <stop offset="0.75" stopColor="#9199a4" />
              <stop offset="0.77" stopColor="#ffbe8a" />
              <stop offset="0.79" stopColor="#202329" />
              <stop offset="0.81" stopColor="#8fc4ff" />
              <stop offset="0.86" stopColor="#f7f9fc" />
              <stop offset="1" stopColor="#ffffff" />
              <animateTransform
                attributeName="gradientTransform"
                type="rotate"
                from={`0 ${L.W / 2} ${L.H / 2}`}
                to={`360 ${L.W / 2} ${L.H / 2}`}
                dur="8s"
                repeatCount="indefinite"
              />
            </linearGradient>
            {/* Everything but the silhouette: the shadow is cut away under
                the body, or it would show through the glass and dim it. */}
            <mask id="cgd-outside" maskUnits="userSpaceOnUse" x="0" y="0" width={L.W} height={L.H}>
              <rect width={L.W} height={L.H} fill="#fff" />
              <use href="#cgd-sil" fill="#000" />
              <use href="#cgd-cube-sil" fill="#000" />
            </mask>
            {/* The glass cube's silhouette, traced from its render; placed
                by the component with the cube. */}
            <path id="cgd-cube-sil" ref={cubeSilRef} d="M-9 -9" />
            {/* The joystick's colour bridge: where the tinted rim shows — the
                reach from the × to the lit button, and that button's rim.
                Placed by the component. */}
            <mask id="cgd-bridge" maskUnits="userSpaceOnUse" x="0" y="0" width={L.W} height={L.H}>
              <line
                ref={bridgeLineRef}
                x1="0"
                y1="0"
                x2="0"
                y2="0"
                stroke="#fff"
                strokeWidth="40"
                strokeLinecap="round"
              />
              <circle ref={bridgeDotRef} cx="0" cy="0" r="34" fill="#fff" />
            </mask>
            <filter id="cgd-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur ref={shadowBlurRef} stdDeviation="9" />
            </filter>
            <filter id="cgd-soft" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
          </defs>
          <g mask="url(#cgd-outside)">
            <use
              href="#cgd-sil"
              className="cgd-shadow"
              transform="translate(2 12)"
              filter="url(#cgd-shadow)"
            />
            <use
              href="#cgd-cube-sil"
              className="cgd-shadow"
              transform="translate(2 12)"
              filter="url(#cgd-shadow)"
            />
          </g>
        </svg>

        {/* Under the glass: the stamps in their folder, frosted by the
            sheet above them and sharp wherever they slide out of the
            outline. Each card carries its own fan: how far left it goes,
            its tilt, and its beat — the front stamp leads and goes
            furthest, the ones behind follow a beat later and stop nearer,
            so they land side by side. */}
        <span
          ref={stampRef}
          aria-hidden
          className={`cgd-stamp ${stampHot ? "is-hot" : ""} ${folderOpen ? "is-open" : ""}`}
        >
          {STAMPS.map((s, i) => {
            const n = STAMPS.length;
            const depth = n - 1 - i; // 0 = front
            return (
              <span
                key={i}
                className="cgd-stamp-card"
                style={
                  {
                    "--stamp-art": `url("${s.art}")`,
                    "--paper": s.paper ?? "#f4efe3",
                    "--dx": `${-(78 - depth * 34)}px`,
                    "--dy": `${-4 - depth * 5}px`,
                    "--rot": `${-8 + depth * 6}deg`,
                    "--delay": `${depth * 0.1}s`,
                  } as React.CSSProperties
                }
              >
                <span className="cgd-stamp-paper">
                  <span className="cgd-stamp-art" />
                </span>
              </span>
            );
          })}
        </span>

        {/* The one sheet of glass, clipped to the silhouette. */}
        <div ref={glassRef} className="cgd-glass" />

        {/* Over the glass: the ripple and the lighting. */}
        <svg
          ref={rippleSvgRef}
          aria-hidden
          className="cgd-svg"
          width={L.W}
          height={L.H}
          viewBox={`0 0 ${L.W} ${L.H}`}
        >
          <g className="cgd-ripple">
            {/* The pond closing over the sunk drop: one ring, once. */}
            {splash > 0 && !waterOk && (
              <g key={splash} className="cgd-ring cgd-splash" style={{ transformOrigin: `${sx}px ${sy}px` }}>
                <circle className="cgd-ring-trough" cx={sx} cy={sy} r={9.5} />
                <circle className="cgd-ring-crest" cx={sx} cy={sy} r={8} />
              </g>
            )}
          </g>
          {/* The chrome rim: an 8px stroke clipped to the inside of the
              silhouette, so 4px shows, drawn over a 10px dark one, so the
              one pixel of that left showing is the line where the rim
              meets the pane. */}
          <use href="#cgd-sil" className="cgd-rim-line" clipPath="url(#cgd-clip)" />
          <use href="#cgd-sil" className="cgd-rim" clipPath="url(#cgd-clip)" />
          <use
            ref={bridgeTintRef}
            href="#cgd-sil"
            className="cgd-rim-tint"
            clipPath="url(#cgd-clip)"
            mask="url(#cgd-bridge)"
          />
        </svg>

        {/* The beacon's white wave, centred on the +; played by pulseBeacon. */}
        <span ref={beaconRef} aria-hidden className="cgd-beacon" style={{ left: sx, top: sy }} />

        {/* Content, riding its bodies. */}
        <div className="cgd-content">
          {/* Start a project, the pad's right-hand button: an animated icon,
              no label — an arrow that leaves up and to the right and comes
              back round from the lower left. */}
          <a
            ref={ctaRef}
            className={`cgd-body cgd-cta ${open ? "is-live" : ""}`}
            style={{ "--hot": HOT_COLOR.cta } as React.CSSProperties}
            href="/contact"
            aria-label="Start a project"
            tabIndex={open ? 0 : -1}
            aria-hidden={!open}
            onPointerEnter={hoverOn("cta")}
            onPointerLeave={hoverOff}
            onPointerDown={pressOn("cta")}
            onPointerUp={pressOff}
          >
            <span aria-hidden className="cgd-inner cgd-go">
              {/* A mail icon, per the client (19 Sep) — it was the diagonal
                  arrow with its nudge. */}
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3.5" y="6" width="17" height="12" rx="2.2" />
                <path d="m4.5 7.5 7.5 5.2 7.5-5.2" />
              </svg>
            </span>
          </a>

          {/* The stamp folder, the pad's left-hand button: the occasion's
              stamps live under the glass (STAMPS) and slide out leftwards
              on hover, when the button becomes the envelope; a click swings
              its front open. */}
          <div
            ref={folderRef}
            className={`cgd-body cgd-slot cgd-folder ${open ? "is-live" : ""}`}
            style={{ "--hot": HOT_COLOR.folder } as React.CSSProperties}
            aria-hidden
            onPointerEnter={(e) => {
              if (e.pointerType === "touch") return; // a tap toggles instead
              apartOn();
              hoverOn("folder")();
              window.clearTimeout(stampTimer.current);
              setStampHot(true);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "touch") return;
              hoverOff();
              apartOff(APART_LINGER_MS);
              setStampHot(false);
            }}
            onPointerDown={(e) => {
              pressOn("folder")();
              if (e.pointerType === "touch") {
                // Tap: the stamps out and the envelope, held until the next
                // tap (which the click below also turns into the front
                // swinging open) or the dock shutting.
                window.clearTimeout(stampTimer.current);
                touchApart.current = !touchApart.current;
                if (touchApart.current) {
                  apartOn();
                  setStampHot(true);
                } else {
                  apartOff(0);
                  setStampHot(false);
                }
              }
            }}
            onPointerUp={pressOff}
            onClick={() => setFolderOpen((v) => !v)}
          />
          {/* The AI doorway, the pad's top button: the red LED matrix
              (destination not built yet — wire its onClick when the AI page
              exists); its "coming soon" bubble rises from it. */}
            <button
              ref={aiRef}
              type="button"
              className={`cgd-body cgd-slot cgd-ai ${open ? "is-live" : ""}`}
              style={{ "--hot": HOT_COLOR.ai } as React.CSSProperties}
              tabIndex={open ? 0 : -1}
              aria-label="Zuhayr AI — coming soon"
              onPointerEnter={(e) => {
                if (e.pointerType === "touch") return; // a tap toggles instead
                hoverOn("ai")();
                bubbleOn();
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "touch") return;
                hoverOff();
                bubbleOff(BUBBLE_LINGER_MS);
              }}
              onPointerDown={(e) => {
                pressOn("ai")();
                if (e.pointerType === "touch") {
                  // Tap: the bubble up until the next tap or the dock shutting.
                  touchBubble.current = !touchBubble.current;
                  if (touchBubble.current) bubbleOn();
                  else bubbleOff(0);
                }
              }}
              onPointerUp={pressOff}
              onFocus={bubbleOn}
              onBlur={() => bubbleOff(0)}
            >
              <span aria-hidden className="cgd-inner">
                <span className="cgd-led">
                  {LED_DOTS.map((d, i) => (
                    <span
                      key={i}
                      className={d.lit ? "cgd-dot" : "cgd-dot is-off"}
                      style={
                        {
                          "--base": d.base,
                          animationDelay: `${d.delay}ms`,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </span>
              </span>
            </button>

          {/* The inside of the envelope, per the film: a lighter, flat panel
              the front swings open on, with the stamp inside sitting sharp
              on it. Sized with the folder; glimpsed as the front cracks
              open on hover, seen while open. */}
          <div
            ref={pocketRef}
            aria-hidden
            className={`cgd-pocket ${folderOpen ? "is-open" : stampHot ? "is-ajar" : ""}`}
          />

          {/* The folder's front: the same glass as the folder, sitting over
              it. On hover it cracks open — a few degrees about its right
              edge, away, so the stamps have room to slide out of the left
              edge and the inside shows along it; on a click it swings open
              (AWAY, receding into the page as the film's does, its far edge
              shrinking with distance) and shuts again. Placed and sized
              with the folder each frame; unseen unless ajar, open or
              closing. */}
          <div
            ref={flapRef}
            aria-hidden
            className={`cgd-flap liquid-glass ${folderOpen ? "is-open" : stampHot ? "is-ajar" : ""}`}
          />

          {/* The AI slot's bubble: "coming soon", the way the hero's Let's
              Talk carries its "accepting new projects" badge. Not a
              target itself; the AI slot is. */}
          <span ref={bubbleRef} aria-hidden className="cgd-body cgd-bubble">
            <span className="cgd-inner">
              <span className="cgd-live">
                <span className="cgd-live-ping" />
                <span className="cgd-live-dot" />
              </span>
              Zuhayr AI · coming soon
            </span>
          </span>

          {/* The glass cube, under the +: a 2D canvas fed from the shared
              WebGL tile (ChromaticMetal). Positioned and scaled per frame
              with the seed's core. Hidden when WebGL is unavailable. */}
          <div ref={cubeFrostRef} aria-hidden className="cgd-cube-frost" />
          <canvas ref={cubeRef} aria-hidden className="cgd-cube" width={1} height={1} />

          <button
            ref={seedRef}
            type="button"
            className={`cgd-body cgd-seed ${visible ? "is-live" : ""}`}
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? "Close quick actions" : "Open quick actions"}
            tabIndex={visible ? 0 : -1}
            onPointerEnter={hoverOn("seed")}
            onPointerMove={leanTo}
            onPointerLeave={() => {
              hoverOff();
              leanOff();
            }}
            onPointerDown={pressOn("seed")}
            onPointerUp={pressOff}
          >
            <span ref={plusRef} aria-hidden className="cgd-plus cgd-inner">
              +
            </span>
          </button>
          {/* The joystick's home: the dot at the +'s centre that stays put
              while the glyph leans after the pointer. */}
          <span ref={homeDotRef} aria-hidden className="cgd-home-dot" />
        </div>
      </div>
    </>
  );
}
