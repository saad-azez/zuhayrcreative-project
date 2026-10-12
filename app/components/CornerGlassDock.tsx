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
import { traceGlass } from "./glassTrace";
import { subscribeGlassCube, subscribeGlassEnvelope, subscribeGlassFile } from "./ChromaticMetal";
import "@/app/styles/corner-dock.css";
import { isPhoneDevice } from "@/app/lib/device";
import FolderSubDial from "./FolderSubDial";
import FolderStack from "./FolderStack";
import { VeronicaTile } from "./VeronicaFlame";
import { STAMPS } from "./dockFolders";

/* The corner's beacon starts a moment after the loader's reveal and then
   keeps its beat for as long as the corner is clear and the dock is shut.
   It used to come and go — up 14s, away 20s — and the client read the gaps
   as the ripple failing: "sometimes it doesn't appear". */
const FIRST_DELAY_MS = 2_500;
/* One beat of the beacon: a white wave out of the + and a splash into the
   water, every BEAT_MS. */
const BEAT_MS = 2_800;
/* Every PEEK_EVERY-th beat the + itself surfaces with the wave and holds
   for PEEK_MS before diving back in, so the corner reads as a button and
   not only as water (client, 4 Oct: "we had the + button itself appearing
   occasionally along with the wave and ripple effects to make it more
   noticeable"). It had been hover-only since 7 Sep (df87d04, "only when
   hovered upon does the + show"). A hover or a click still brings it out
   and keeps it, as before. */
const PEEK_EVERY = 3;
const PEEK_MS = 2_400;
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
   CSS), come from dockFolders.ts, shared with the folder's own sub dial
   (FolderSubDial). Per the client's reference, AdityaSur11's "Stamp
   Folder animation": stamps tucked in a frosted folder that slide out of
   its edge on hover, fanned. Back to front; the last is the front one,
   and goes furthest. */
/* The coloured folders the glass file holds, each with the stamps inside
   it (client, 25 Sep: "within it it's still missing the additional
   coloured transparent folders which then have the stamps — that's what's
   missing as a whole from the ref"). The reference's folder comes in
   yellow, magenta and black: a frosted colour front with the stamps a soft
   shape through it and their edges peeking out on the right; hovered, the
   stamps slide out of that edge; clicked, the front swings open like a
   book cover. Here all three live in the glass file: it opens, they lift
   out of its mouth and fan left, and each is that folder. Back to front;
   the last one lands nearest the file. `tint` is the translucent front,
   `edge` the back panel that shows as the folder's thickness. */
const SLEEVES: ReadonlyArray<{ tint: string; edge: string }> = [
  { tint: "rgba(30, 30, 34, 0.84)", edge: "#0d0d10" }, // black
  { tint: "rgba(221, 40, 158, 0.8)", edge: "#9e1270" }, // magenta
  { tint: "rgba(228, 182, 56, 0.82)", edge: "#b0851b" }, // yellow
];
/* The mail button's glass envelope canvas, CSS px (the button is 52). */
const ENV_PX = 50;
const SLEEVE_W = 34;
const SLEEVE_H = 44;
/* How long a pointer that has left the folder or a coloured folder has to
   reach the next one before the file closes — they stand ~10-20px apart. */
const SLEEVE_LINGER_MS = 340;
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
/* The folder's 3D form (see ChromaticMetal's file): an 84px canvas framed
   so the face-on file is exactly the flat 50x62 envelope. While it shows,
   the flat body under it draws in to a core, hidden behind the glass, so
   a bridge still has something to hold on to. */
const FILE_PX = 84;
const FILE_CORE_W = 26;
const FILE_CORE_H = 34;
/* On the way from circle to file the body first draws up into a tall drop,
   then squares off into the envelope. */
const FOLDER_DROP_W = 38;
const FOLDER_DROP_H = 60;
/* The folder is a looser, jellier spring than the rest: its circle-to-file
   morph lands past its shape and wobbles back. */
const FOLDER_ZETA = 0.55;
/* ...and slower, so the circle is SEEN stretching into its drop and
   squaring off into the file before the file turns solid. */
const FOLDER_K = 55;

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
/* The dock's other icons fading out round the folder before its hand-over
   to the folder's own dial, and back in after it (.is-handoff in the CSS). */
const HANDOFF_MS = 220;
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* A pad button's glass body melts into its icon over its last MELT_PX of
   travel, gone MELT_GAP px from home (see hideBodies). */
const MELT_PX = 26;
const MELT_GAP = 3;
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
/* The shut: how long after it the + waits for the buttons to be back
   inside it before it glides home. */
const HOME_DELAY_MS = 560;
/* The size of a button's drop as it travels back into the +. */
const DROP_BACK = 22;
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
/* How far the glue draws a hovered button in towards the +. */
const HOVER_PULL = 5;
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
/* A touch under critical (20 Sep, the client: "more droppy, gooey"): the
   bodies land a hair past their place and settle, like drops. */
const ZETA = 0.8;
const DAMP = 2 * Math.sqrt(K) * ZETA;
const S_REST = 5;
const S_FLOW = 16;
const FULL_SPEED = 420;
const SWELL = 4;
const PRESS = -3;

/* The AI slot's 5×5 LED matrix, modelled on the reference's Record icon:
   a round cluster of dots (corners stay dark), centre brightest, each
   dot's breathing delayed by its distance from centre so the pulse
   travels outward as a wave. Computed once — it's geometry, not state. */
/* Which AI button the pad's top slot shows. "veronica": WRAITH's pixel-flame
   tile (VeronicaFlame.tsx), the client's design of 5 Oct ("archive the
   existing AI button and replace it with this one"). "led": the archived
   button — the red 5x5 LED matrix in a round glass body — kept intact, the
   LED_DOTS below and its .cgd-led styles included, to come back with one
   word. */
const AI_BUTTON: "veronica" | "led" = "veronica";

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
  /** The pad's buttons round it: start-a-project left, the AI doorway on
      top (its bubble rises into the room above), the stamp folder right,
      in the corner (on a phone: mail left, folder above). */
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
    const H = EDGE + SEED / 2 + PHONE_TOP + FOLDER_H / 2 + GAP + BUBBLE_H + PAD_TOP;
    const seed = { x: W - EDGE - SEED / 2, y: H - EDGE - SEED / 2 };
    // The mail button left, the folder above (client, 8 Oct: "switch the
    // folder and email positions").
    const cta = { x: seed.x - PHONE_SIDE, y: seed.y };
    const ai = { x: seed.x - PHONE_DIAG_X, y: seed.y - PHONE_DIAG_Y };
    const folder = { x: seed.x, y: seed.y - PHONE_TOP };
    // The bubble's pill stands in a row ABOVE the whole fan, its right end
    // on the corner column: centred on the diagonal AI box it ran into the
    // top button and out of the stage's left edge (verified with the
    // field's own distance function — overlapping bodies fuse whatever
    // the goo scale). Its bead still rises out of the AI box's top.
    const bubble = { x: W - EDGE - bubbleW / 2, y: folder.y - FOLDER_H / 2 - GAP - BUBBLE_H / 2 };
    return { W, H, seed, seedOut: seed, folder, ai, cta, bubble };
  }
  const reach = Math.max(PAD_DX * 2 + SEED, PAD_DX + SEED / 2 + bubbleW / 2);
  const W = PAD_LEFT + reach + EDGE;
  const H = PAD_TOP + BUBBLE_H + GAP + PAD_DY_TOP + SEED + EDGE;
  const RX = W - EDGE;
  const seed = { x: RX - SEED / 2, y: H - EDGE - SEED / 2 };
  const seedOut = { x: seed.x - PAD_DX, y: seed.y };
  const sideY = seedOut.y - PAD_DY_SIDE;
  // The mail button left, the folder right, in the corner (client, 8 Oct:
  // "switch the folder and email positions").
  const cta = { x: seedOut.x - PAD_DX, y: sideY };
  const folder = { x: seedOut.x + PAD_DX, y: sideY };
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
  /** How far the body still is from its final place (px, centre to centre). */
  fromHome() {
    return Math.hypot(this.cur[0] - this.dest[0], this.cur[1] - this.dest[1]);
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
    body.wob = Math.min(1.5, this.travel * 0.003 + Math.hypot(vel[2], vel[3]) * 0.0008);
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
  /** The folder's 3D file: canvas, frosted skin, silhouette, controls. */
  file: HTMLCanvasElement | null;
  fileFrost: HTMLDivElement | null;
  /** The small coloured folders inside the file, moved with it. */
  fileStack: HTMLSpanElement | null;
  fileSil: SVGPathElement | null;
  fileSet: ((p: Partial<{ form: number; open: number }>) => void) | null;
  fileActive: ((on: boolean) => void) | null;
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
  /* The lit button's landing quiver: which button, and how much is left. */
  private wobLit: Lit | null = null;
  private wobT = 0;
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
    this.folder.k = FOLDER_K;
    this.folder.damp = 2 * Math.sqrt(FOLDER_K) * FOLDER_ZETA;
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
    } else if (!this.reduced && visible && this.ptr && !this.cube) {
      // Not with the glass cube: the cube is drawn apart from the liquid
      // sheet, so a tail reaching for the pointer had nothing to grow out
      // of and read as a loose ring beside the cube. (The bridge to a lit
      // button above stays: it runs from under the cube to the button.)
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
      // Glue, not a rod: thick where it leaves the + and thick again where
      // it takes hold of the button, pinched thin in the middle - the
      // drop-forming neck of a gluey liquid pulled between two bodies.
      const waist = 1 - 0.62 * Math.sin(u * Math.PI);
      const size = (TAIL_ROOT + (TAIL_END + 8 - TAIL_ROOT) * u) * waist * on;
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
      // Hovered, the glue between it and the + draws it a few px in.
      if (open && hover === which && which !== "seed") {
        const sx = L.seedOut.x;
        const sy = L.seedOut.y;
        const dx = sx - at.x;
        const dy = sy - at.y;
        const k = HOVER_PULL / (Math.hypot(dx, dy) || 1);
        return [at.x + dx * k, at.y + dy * k, d, d, d / 2];
      }
      return [at.x, at.y, d, d, d / 2];
    };
    // The folder is its glass FILE whenever the pad is open, not only while
    // hovered: with no circle drawn round it (see hideBodies) it has to be
    // the file to be anything at all.
    const apart = this.intent.apart || this.intent.open;
    // The folder's drop leg on its way from circle to file.
    const folderDrop: Vec5 = [L.folder.x, L.folder.y - 3, FOLDER_DROP_W, FOLDER_DROP_H, FOLDER_DROP_W / 2];
    const folderAt: Vec5 = apart && this.fileSolid
      ? // The file is solid: the flat body waits as a core under it, and
        // grows back into a circle out from under it as it goes flat.
        [L.folder.x, L.folder.y, FILE_CORE_W, FILE_CORE_H, FILE_CORE_W / 2]
      : apart
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
      [this.cta, round(L.cta, "cta"), 0],
      [this.ai, round(L.ai, "ai"), TOP_DELAY_MS],
      [this.folder, folderAt, RIGHT_DELAY_MS],
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
        for (const [slot, at] of buttons) {
          if (this.delayed.has(slot)) continue;
          // Circle to file: up into a tall drop first, then square off.
          if (slot === this.folder && apart && slot.cur[3] < FOLDER_DROP_H - 6) {
            slot.aim(at, [folderDrop, (b) => b.cur[3] > FOLDER_DROP_H - 8]);
          } else {
            bud(slot, at);
          }
        }
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
          // Each button goes back INTO the +, the way it came: it draws
          // in to a round drop, travels home, and is taken in under the
          // cube (it shrinks to nothing only once it is there).
          const sx = this.seed.cur[0];
          const sy = this.seed.cur[1];
          for (const [slot] of buttons) {
            if (slot.cur[2] < 1 && slot.cur[3] < 1) continue;
            slot.route(
              [sx, sy, 0, 0, 0],
              [[sx, sy, DROP_BACK, DROP_BACK, DROP_BACK / 2], (b) => Math.hypot(b.cur[0] - sx, b.cur[1] - sy) < 6]
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
    // The lit button quivers as the glue takes hold of it, dying away.
    if (this.lit !== this.wobLit) {
      this.wobLit = this.lit;
      this.wobT = this.lit ? 1 : 0;
    }
    if (this.lit && this.wobT > 0) {
      this.wobT = Math.max(0, this.wobT - dt * 1.6);
      const body = this[this.lit].body;
      body.wob = Math.max(body.wob, 0.9 * this.wobT);
      if (this.wobT > 0) settled = false;
    }
    this.chain();
    // The cube stands in for the seed: keep its spring, paint no body.
    if (this.cube) this.seed.body.w = 0;
    this.formFile(dt);
    this.hideBodies();
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
      this.formFile(0);
      this.hideBodies();
      if (Math.abs(this.fileWant - this.fileNow) > 0.002) {
        this.raf = requestAnimationFrame(this.tick);
        return;
      }
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

  /* The 3D file: 0 flat, 1 formed. It forms once the flat body has become
     the envelope (and not before: the client wants to SEE the circle turn
     into a file, then the file turn solid), and goes flat again as soon as
     the folder is let go. */
  private fileNow = 0;
  private fileWant = 0;
  private fileSolid = false;
  private formFile(dt: number) {
    const { file } = this.els;
    if (!file) return;
    const { open } = this.intent;
    const shaped = this.fileSolid || (this.folder.cur[3] > FOLDER_H - 6 && this.folder.cur[2] > FOLDER_W - 6);
    // Formed as soon as it has squared off in the open pad (see retarget).
    const want = open && shaped ? 1 : 0;
    if (want !== this.fileWant) {
      this.fileWant = want;
      this.els.fileSet?.({ form: want });
      if (!want && this.fileSolid) {
        this.fileSolid = false;
        this.retarget();
      }
    }
    const rate = want ? 5 : 9;
    this.fileNow += (want - this.fileNow) * Math.min(1, dt * rate);
    if (Math.abs(want - this.fileNow) < 0.002) this.fileNow = want;
    if (want && !this.fileSolid && this.fileNow > 0.97) {
      this.fileSolid = true;
      this.retarget();
    }
    // Under the solid file the flat body draws in to a hidden core.
    const b = this.folder.body;
    const k = this.fileNow;
    if (k > 0) {
      b.w = b.w + (FILE_CORE_W - b.w) * k;
      b.h = b.h + (FILE_CORE_H - b.h) * k;
      b.r = b.r + (FILE_CORE_W / 2 - b.r) * k;
    }
  }
  /** No circles round the glass folder and the mail button's envelope
      (client, 4 Oct: "get rid of the circles around the glass folder and
      email icons") — at REST. On the way, the body is the glass: hidden the
      whole trip, the + budding into its buttons showed only a bead and a
      frosted smear (client, 9 Oct: "lacking the glass look, it's just a blur
      effect"). So each button's body travels out of the + as a full body of
      lit glass and melts into its icon over the last MELT_PX as it arrives
      (and grows back out of it as it leaves). The folder's also gives way
      to its 3D file as that forms. Without WebGL the folder keeps its
      circle: there is no glass file to stand in its place. */
  private hideBodies() {
    const melt = (slot: Slot) => {
      const k = Math.min(1, Math.max(0, (slot.fromHome() - MELT_GAP) / MELT_PX));
      const b = slot.body;
      b.w *= k;
      b.h *= k;
      b.r *= k;
    };
    if (this.els.file) {
      melt(this.folder);
      const f = 1 - this.fileNow;
      this.folder.body.w *= f;
      this.folder.body.h *= f;
    }
    melt(this.cta);
    // The Veronica tile is its own glass; no circle round it either.
    if (AI_BUTTON === "veronica") melt(this.ai);
  }
  /** The folder is open: tip the file back to let the stamps out. */
  setFileOpen(on: boolean) {
    this.els.fileSet?.({ open: on ? 1 : 0 });
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
    // While the 3D file stands over it, the slot (the hover area) keeps the
    // file's size, not the hidden core's.
    const solid = this.fileNow > 0.5;
    const fw = solid ? FOLDER_W : Math.max(0, this.folder.cur[2]);
    const fh = solid ? FOLDER_H : Math.max(0, this.folder.cur[3]);
    const fr = solid ? FOLDER_R : Math.max(0, this.folder.cur[4]);
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
    // The coloured folders (and their stamps) sit dead centre in the file.
    at(stamp, folderB.x - SLEEVE_W / 2, folderB.y - SLEEVE_H / 2);

    // The 3D file over the folder: in as it forms (a small swell from
    // 0.94), out as it goes flat.
    const { file, fileFrost, fileSil, fileStack } = this.els;
    if (file) {
      const k = this.fileNow;
      const on = k > 0.01;
      const x = folderB.x - FILE_PX / 2;
      const y = folderB.y - FILE_PX / 2;
      const sc = 0.94 + 0.06 * k;
      const tf = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${sc.toFixed(3)})`;
      file.style.transform = tf;
      file.style.opacity = Math.min(1, k * 1.6).toFixed(3);
      file.style.visibility = on ? "visible" : "hidden";
      if (fileStack) {
        fileStack.style.transform = tf;
        fileStack.style.opacity = file.style.opacity;
        fileStack.style.visibility = file.style.visibility;
      }
      if (fileFrost) {
        fileFrost.style.transform = tf;
        fileFrost.style.opacity = file.style.opacity;
        fileFrost.style.visibility = file.style.visibility;
      }
      fileSil?.setAttribute(
        "transform",
        // Its shadow goes with it: at scale 0 the traced outline casts none.
        `translate(${(x + FILE_PX / 2).toFixed(2)} ${(y + FILE_PX / 2).toFixed(2)}) scale(${(on ? sc * Math.min(1, k * 1.6) : 0).toFixed(3)}) translate(${-FILE_PX / 2} ${-FILE_PX / 2})`
      );
      this.els.fileActive?.(on);
      this.els.stage.classList.toggle("has-file", on);
      // The stamps come out only once the file is solid.
      this.els.stage.classList.toggle("file-solid", this.fileSolid && k > 0.97);
      // With the 3D file the flat front and pocket are never used. Set every
      // frame: React rewrites the stage's classes when the dock opens.
      this.els.stage.classList.add("has-3d-file");
    }

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
    const tintOn = "0"; // no coloured rim on the bridge any more
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
    // Out = at its place AND grown: a button still parked at the + at no
    // size (waiting its turn while the + glides) had "arrived" at its
    // parking target, was flagged in and interactive under the pointer that
    // had just clicked, and lit up / raised the bubble on the way out.
    const grown = (slot: Slot) => slot.cur[2] > SEED * 0.6;
    flag(cta, open && grown(this.cta) && this.cta.arrived(9));
    // Under the solid file the flat body is only its core: still in.
    const folderIn = open && (this.fileSolid || (grown(this.folder) && this.folder.arrived(9)));
    flag(folder, folderIn);
    stamp.classList.toggle("is-in", folderIn);
    flag(ai, open && grown(this.ai) && this.ai.arrived(9));
    flag(bubble, open && this.intent.bubble && this.bubble.arrived(9));
  }
}

/**
 * Corner glass dock. What the visitor sees first is a very small RIPPLE
 * welling out of the bottom-right corner on a steady beat (see the timing
 * constants). Hover the corner and the + box slides in off the edge of
 * the screen; click it and three round buttons bud off it, liquid-glass
 * fashion, and stand round it like a game pad's face buttons — the stamp
 * start-a-project left, the AI doorway on top, the folder right — while the
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
  // The + surfacing on its own on the beat (see PEEK_EVERY).
  const [peek, setPeek] = useState(false);
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
  // Out of the open file: the coloured folder whose stamps are sliding out
  // (hovered), and the one whose front is swung open (clicked / tapped).
  const [sleeveHot, setSleeveHot] = useState<number | null>(null);
  const [sleeveOpen, setSleeveOpen] = useState<number | null>(null);
  // The glass folder's own dial (FolderSubDial), which a click on the folder
  // opens in place of the + dial.
  const [subDial, setSubDial] = useState(false);
  // The hand-over to it, and back (client, 8 Oct: one folder, seamless; the
  // + box's other icons out of the way first, and back last). "hide": every
  // part of the dock but the glass folder fades out; "show": they fade back
  // in. Through the sub dial the dock stays OPEN, only hidden (.is-sub), so
  // its folder is standing in its place when the hub comes back to it.
  const [handoff, setHandoff] = useState<"" | "hide" | "show">("");
  const [subFrom, setSubFrom] = useState<DOMRect | null>(null);
  const handoffTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(handoffTimer.current), []);
  // Where the dock's glass folder stands on screen: its 3D file's canvas
  // (the frame the hub's canvas matches), or the flat slot without WebGL.
  // (Looked up, not read from the refs: the effects that set the canvas
  // up write to it, and the compiler will not have a callback hold it.)
  const folderRect = useCallback((): DOMRect | null => {
    const file = document.querySelector<HTMLCanvasElement>(".cgd-stage canvas.cgd-file");
    if (file && !file.hidden) return file.getBoundingClientRect();
    return document.querySelector(".cgd-stage .cgd-folder")?.getBoundingClientRect() ?? null;
  }, []);
  // The hub is back on the folder (or gone into the +): the dock shows
  // again with only the folder at first — exactly where the hub ends — and
  // a frame later the rest fades back in round it.
  const handBack = useCallback(() => {
    setSubDial(false);
    setHandoff("hide");
    window.clearTimeout(handoffTimer.current);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setHandoff("show");
        handoffTimer.current = window.setTimeout(() => setHandoff(""), HANDOFF_MS + 60);
      }),
    );
  }, []);
  // The AI slot is being hovered, focused or tapped: Veronica's flame rises
  // ("listening") while the "coming soon" bubble shows.
  const [aiActive, setAiActive] = useState(false);
  // The pointer is somewhere over the stack: it spreads, so every folder in
  // it offers a strip big enough to hover. Released a beat after the pointer
  // leaves the LAST folder — moving from one folder to the next fires a
  // leave before the enter, and collapsing in between moved the stack out
  // from under the pointer (client, 27 Sep: "if I move my mouse from one
  // child to another, the whole animation goes back to normal").
  const [stackHot, setStackHot] = useState(false);
  const stackTimer = useRef(0);
  const stampTimer = useRef(0);
  // On touch the reveals are TAP-TOGGLED, not timed: the client (19 Sep)
  // wants a phone user able to look at the stamps and the bubble for as
  // long as they like. A tap shows them; the next tap, or the dock
  // shutting, hides them. These remember which is showing.
  const touchApart = useRef(false);
  const touchBubble = useRef(false);
  useEffect(() => () => window.clearTimeout(stampTimer.current), []);
  useEffect(() => () => window.clearTimeout(stackTimer.current), []);
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
    const onScreen = new Set<Element>();
    const scope = new Map<Element, MediaQueryList>();
    const watched = new WeakSet<Element>();
    const queries = new Set<MediaQueryList>();

    const counts = (el: Element) => scope.get(el)?.matches ?? true;
    const settle = () => {
      let blocked = false;
      for (const el of onScreen) {
        // A rival React has since thrown away is not on anyone's screen.
        if (!el.isConnected) {
          onScreen.delete(el);
          continue;
        }
        if (counts(el)) blocked = true;
      }
      setClear(!blocked);
    };

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) onScreen.add(e.target);
        else onScreen.delete(e.target);
      }
      settle();
    });

    // The rivals are looked for again whenever the page's nodes change, not
    // once at mount.
    //
    // Once at mount was wrong, and quietly so. React does not always keep the
    // element it first rendered — a subtree it re-creates (a hydration it
    // discards, a section mounted late) leaves the observer holding a node
    // that is no longer in the document, and nothing then tells the dock that
    // the live one is on screen. Measured on the services section: the button
    // the observer watched reported `isConnected: false`, its last
    // intersection was "off screen" a second into the load, and the dock sat
    // lit in the corner underneath the Expand button for the rest of the
    // visit — taking the taps meant for it, since the corner is only
    // clickable while it is live.
    //
    // Re-scanning is close to free: a full scroll of the home page produces
    // about fifty childList batches, and each scan is a querySelectorAll that
    // matches three elements.
    let queued = 0;
    const scan = () => {
      queued = 0;
      let added = false;
      for (const el of document.querySelectorAll<HTMLElement>(
        "[data-corner-dock-avoid]",
      )) {
        if (watched.has(el)) continue;
        watched.add(el);
        // A bare JSX attribute arrives as "true"; only a query counts as one.
        const q = el.getAttribute("data-corner-dock-avoid")?.trim() ?? "";
        if (q.startsWith("(")) {
          const mql = window.matchMedia(q);
          scope.set(el, mql);
          // A rival can start or stop counting on a resize (a window narrowed
          // to the phone layout, a phone turned) without moving on screen.
          if (!queries.has(mql)) {
            queries.add(mql);
            mql.addEventListener("change", settle);
          }
        }
        io.observe(el);
        added = true;
      }
      // Drop anything that has left the document even if nothing was added,
      // so a departed rival cannot keep the dock suppressed either.
      if (added || Array.from(onScreen).some((el) => !el.isConnected)) settle();
    };
    const rescan = () => {
      if (queued) return;
      queued = window.setTimeout(scan, 200);
    };

    scan();
    const mo = new MutationObserver(rescan);
    mo.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      window.clearTimeout(queued);
      for (const mql of queries) mql.removeEventListener("change", settle);
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
    // The dock shutting (or opening afresh) shuts the folder too, and the
    // folder's sub dial.
    setFolderOpen(false);
    setSubDial(false);
    window.clearTimeout(handoffTimer.current);
    setHandoff("");
    setOpen((v) => {
      openRef.current = !v;
      return !v;
    });
  }, []);

  // Escape collapses the boxes back into the +.
  // (Not while the folder's dial is up: Escape is its, and it hands back.)
  useEffect(() => {
    if (!open || subDial) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        openRef.current = false;
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, subDial]);

  // The + is out while the corner is hot, the dock has been used, or the
  // beat has brought it up for a moment; open, it stays even over a rival —
  // the user asked for it. The beacon beats whenever the corner is clear and
  // the dock is shut.
  const visible = open || ((hot || engaged || peek) && clear);
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
  // The mail button's glass envelope (see subscribeGlassEnvelope).
  const envRef = useRef<HTMLCanvasElement>(null);
  const envFrostRef = useRef<HTMLSpanElement>(null);
  const envGlass = useRef<ReturnType<typeof subscribeGlassEnvelope>>(null);
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
  const fileRef = useRef<HTMLCanvasElement>(null);
  const fileFrostRef = useRef<HTMLDivElement>(null);
  const fileStackRef = useRef<HTMLSpanElement>(null);
  const fileSilRef = useRef<SVGPathElement>(null);
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
      const d = traceGlass(tracer, ctx, px, CUBE_PX);
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
    // The folder's 3D file, traced the same way for its skin and shadow.
    const fileCanvas = fileRef.current;
    const fileTracer = new LiquidField(FILE_PX, FILE_PX, 1);
    const fileGlass = fileCanvas
      ? subscribeGlassFile(
          fileCanvas,
          () => FILE_PX * Math.min(window.devicePixelRatio || 1, 2),
          (ctx, px) => {
            const d = traceGlass(fileTracer, ctx, px, FILE_PX);
            if (fileFrostRef.current) {
              fileFrostRef.current.style.clipPath = d ? `path("${d}")` : 'path("M-9 -9Z")';
            }
            fileSilRef.current?.setAttribute("d", d || "M-9 -9");
          }
        )
      : null;
    if (fileCanvas) fileCanvas.hidden = !fileGlass;
    if (fileFrostRef.current) fileFrostRef.current.hidden = !fileGlass;
    if (cubeFrostRef.current) cubeFrostRef.current.hidden = !glass;
    const sim = new DockSim(
      {
        ...els,
        cube: glass ? canvas : null,
        cubeFrost: glass ? cubeFrostRef.current : null,
        cubeSil: glass ? cubeSilRef.current : null,
        cubeActive: glass ? glass.setActive : null,
        file: fileGlass ? fileCanvas : null,
        fileFrost: fileGlass ? fileFrostRef.current : null,
        fileStack: fileGlass ? fileStackRef.current : null,
        fileSil: fileGlass ? fileSilRef.current : null,
        fileSet: fileGlass ? fileGlass.set : null,
        fileActive: fileGlass ? fileGlass.setActive : null,
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
      fileGlass?.setActive(false);
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
  // The folder opened: the 3D file tips back and the coloured folders come
  // out. The stamp layer's phase classes are set here, not through its
  // className (see the note on its markup).
  useEffect(() => {
    simRef.current?.setFileOpen(folderOpen);
  }, [folderOpen]);
  // The glass envelope: drawn only while the pad is open (the button is
  // hidden otherwise). Without WebGL the drawn envelope stays in its place.
  useEffect(() => {
    const canvas = envRef.current;
    if (!canvas) return;
    // Frosted like the cube and the file (client, 8 Oct: the envelope had
    // no frost, so it showed as little more than a clear outline): the
    // skin under it is clipped to its silhouette, traced the same way.
    const tracer = new LiquidField(ENV_PX, ENV_PX, 1);
    const g = subscribeGlassEnvelope(
      canvas,
      () => ENV_PX * Math.min(window.devicePixelRatio || 1, 2),
      (ctx, px) => {
        const d = traceGlass(tracer, ctx, px, ENV_PX);
        if (envFrostRef.current) {
          envFrostRef.current.style.clipPath = d ? `path("${d}")` : 'path("M-9 -9Z")';
        }
      }
    );
    envGlass.current = g;
    // A data attribute, not a class: React rewrites the button's className
    // whenever the pad opens, which would wipe a class set here.
    if (ctaRef.current) ctaRef.current.dataset.glassEnv = g ? "1" : "0";
    return () => {
      g?.setActive(false);
      envGlass.current = null;
    };
  }, []);
  useEffect(() => {
    envGlass.current?.setActive(open);
  }, [open]);

  useEffect(() => {
    const el = stampRef.current;
    if (!el) return;
    el.classList.toggle("is-hot", stampHot);
    el.classList.toggle("is-open", folderOpen);
    el.classList.toggle("is-spread", folderOpen && stackHot);
  }, [stampHot, folderOpen, stackHot]);

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
    // No water splash on phones and tablets. The beat (2.8s) is shorter than
    // FluidCursor's sleep (3s), so every beat woke the full-screen water
    // simulation before it could stop: it ran every frame for the whole
    // visit. A finger stirs no wake there, so the beat was all it was running
    // for. The white wave above needs no WebGL and still marks the corner.
    const splashes = waterOk && !isPhoneDevice();
    let beat = 0;
    let peekTimer = 0;
    const fire = () => {
      if (document.hidden || document.body.classList.contains("menu-open")) return;
      pulseBeacon();
      if (splashes) splashWater();
      // Every PEEK_EVERY-th beat, the first included, the + rises with it.
      if (beat++ % PEEK_EVERY === 0) {
        setPeek(true);
        window.clearTimeout(peekTimer);
        peekTimer = window.setTimeout(() => setPeek(false), PEEK_MS);
      }
    };
    fire();
    const iv = window.setInterval(fire, BEAT_MS);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(peekTimer);
      setPeek(false);
    };
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
        className={`cgd-corner ${clear && !subDial ? "is-live" : ""}`}
        onPointerEnter={heat}
        onPointerDown={heat}
        onPointerLeave={cool}
      />
      <div
        ref={stageRef}
        className={`cgd-stage ${open ? "is-open" : ""} ${subDial ? "is-sub" : ""} ${
          handoff === "hide" ? "is-handoff" : handoff === "show" ? "is-handback" : ""
        }`}
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
            {/* The rim (see .liquid-glass::before in globals.css): WRAITH's
                brushed aluminium with its crimson glint, as a gradient that
                turns about the stage once every 12s, so it flows round every
                body's edge. Repeats along its length so a long body gets
                several glints. */}
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
              <stop offset="0.083" stopColor="#c9ced8" />
              <stop offset="0.167" stopColor="#5d626c" />
              <stop offset="0.264" stopColor="#eef1f5" />
              <stop offset="0.417" stopColor="#8a909b" />
              <stop offset="0.45" stopColor="#ff5a6e" />
              <stop offset="0.472" stopColor="#2a2d33" />
              <stop offset="0.556" stopColor="#f5f7fa" />
              <stop offset="0.722" stopColor="#9aa0aa" />
              <stop offset="0.889" stopColor="#ffffff" />
              <stop offset="1" stopColor="#ffffff" />
              <animateTransform
                attributeName="gradientTransform"
                type="rotate"
                from={`0 ${L.W / 2} ${L.H / 2}`}
                to={`360 ${L.W / 2} ${L.H / 2}`}
                dur="12s"
                repeatCount="indefinite"
              />
            </linearGradient>
            {/* Everything but the silhouette: the shadow is cut away under
                the body, or it would show through the glass and dim it. */}
            <mask id="cgd-outside" maskUnits="userSpaceOnUse" x="0" y="0" width={L.W} height={L.H}>
              <rect width={L.W} height={L.H} fill="#fff" />
              <use href="#cgd-sil" fill="#000" />
              <use href="#cgd-cube-sil" fill="#000" />
              <use href="#cgd-file-sil" fill="#000" />
            </mask>
            {/* The glass cube's silhouette, traced from its render; placed
                by the component with the cube. */}
            <path id="cgd-cube-sil" ref={cubeSilRef} d="M-9 -9" />
            <path id="cgd-file-sil" ref={fileSilRef} d="M-9 -9" />
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
            {/* The sheet's own light (client, 9 Oct: the + budding into its
                buttons "lacking the glass look, it's just a blur"): every
                body lit as the dock's glass objects are, from inside its
                own outline and with no border (the rim stays hidden, as
                asked 19-20 Sep). Each is the silhouette minus itself
                moved, so it follows every bud and neck: */}
            {/* a bright crescent along the edges facing up, */}
            <filter id="cgd-lit" x="-10%" y="-10%" width="120%" height="120%">
              <feOffset in="SourceAlpha" dy="1.6" result="o" />
              <feComposite in="SourceGraphic" in2="o" operator="out" result="e" />
              <feGaussianBlur in="e" stdDeviation="0.5" />
            </filter>
            {/* a soft sheen falling from the top, */}
            <filter id="cgd-sheen" x="-10%" y="-10%" width="120%" height="120%">
              <feOffset in="SourceAlpha" dy="9" result="o" />
              <feComposite in="SourceGraphic" in2="o" operator="out" result="e" />
              <feGaussianBlur in="e" stdDeviation="3" />
            </filter>
            {/* a darker edge along the bottom, inside, */}
            <filter id="cgd-under" x="-10%" y="-10%" width="120%" height="120%">
              <feOffset in="SourceAlpha" dy="-2" result="o" />
              <feComposite in="SourceGraphic" in2="o" operator="out" result="e" />
              <feGaussianBlur in="e" stdDeviation="0.8" />
            </filter>
            {/* and a faint band just inside the whole edge: the thickness. */}
            <filter id="cgd-band" x="-10%" y="-10%" width="120%" height="120%">
              <feMorphology in="SourceAlpha" operator="erode" radius="3" result="i" />
              <feComposite in="SourceGraphic" in2="i" operator="out" result="e" />
              <feGaussianBlur in="e" stdDeviation="1.4" />
            </filter>
          </defs>
          <g mask="url(#cgd-outside)">
            <use
              href="#cgd-sil"
              className="cgd-shadow"
              transform="translate(2 12)"
              filter="url(#cgd-shadow)"
            />
            {/* The 3D cube and file cast none: under the glass their
                shadow read as a dark box (client, 8 Oct). */}
          </g>
        </svg>

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
          {/* The glass's light, inside the outline (see cgd-lit and the
              filters beside it). */}
          <g className="cgd-light" clipPath="url(#cgd-clip)">
            <use href="#cgd-sil" fill="#000" opacity="0.22" filter="url(#cgd-band)" />
            <use href="#cgd-sil" fill="#fff" opacity="0.26" filter="url(#cgd-sheen)" />
            <use href="#cgd-sil" fill="#000" opacity="0.38" filter="url(#cgd-under)" />
            <use href="#cgd-sil" fill="#fff" opacity="0.85" filter="url(#cgd-lit)" />
          </g>
          {/* No chrome rim on the bodies (client, 19-20 Sep: "hide the
              border rim"). The tinted copy below stays at opacity 0. */}
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
          {/* Start a project, the pad's left-hand button: an animated icon,
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
            onPointerMove={(e) => {
              // The glass envelope leans towards the pointer, as the cube does.
              const r = e.currentTarget.getBoundingClientRect();
              envGlass.current?.tilt(
                ((e.clientX - r.left) / r.width - 0.5) * 2,
                ((e.clientY - r.top) / r.height - 0.5) * 2
              );
            }}
            onPointerLeave={() => {
              hoverOff();
              envGlass.current?.tilt(0, 0);
            }}
            onPointerDown={pressOn("cta")}
            onPointerUp={pressOff}
          >
            {/* The glass envelope and its frost, on the button itself and
                not in .cgd-inner: that wrapper's blur-in is a CSS filter,
                and under a filtered ancestor a backdrop-filter sees only
                the wrapper, not the page — the envelope's frost frosted
                nothing, so it never had the +'s body (client, 8 Oct:
                "match it to the + button"). */}
            <span aria-hidden className="cgd-env-box">
              <span ref={envFrostRef} className="cgd-cube-frost cgd-env-frost" />
              <canvas ref={envRef} className="cgd-env-glass" width={1} height={1} />
            </span>
            <span aria-hidden className="cgd-inner cgd-go">
              {/* Mail, as a small 3D envelope (client, 25 Sep: "something
                  better, can be 3D looking"; 19 Sep it became a mail icon,
                  first a flat outline). Shaded like an object lit from above:
                  the open flap and inside darker, a letter standing in the
                  mouth, the pocket's two side folds shaded against its
                  bottom fold, a slab edge under it for thickness, and a
                  glossy brand-red wax seal where the folds meet. The letter
                  peeks up now and then, and rises on hover. */}
              {/* The envelope in the folder's and the cube's GLASS (client,
                  26 Sep: "something that matches the style of the 3D
                  folder"), raymarched in ChromaticMetal's shared context. */}
              {/* The drawn envelope below is the fallback where there is
                  no WebGL (hidden once the glass one is running). */}
              <svg className="cgd-env" viewBox="0 0 32 32" width="34" height="34">
                <defs>
                  <linearGradient id="cgd-env-inside" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#8f8898" />
                    <stop offset="1" stopColor="#5f5868" />
                  </linearGradient>
                  <linearGradient id="cgd-env-letter" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#ffffff" />
                    <stop offset="1" stopColor="#ece6dc" />
                  </linearGradient>
                  <linearGradient id="cgd-env-side" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f4f1f6" />
                    <stop offset="1" stopColor="#c9c3cf" />
                  </linearGradient>
                  <linearGradient id="cgd-env-bottom" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#ffffff" />
                    <stop offset="1" stopColor="#dcd7e0" />
                  </linearGradient>
                  <clipPath id="cgd-env-clip">
                    <rect x="4" y="11.6" width="24" height="15.4" rx="2.6" />
                  </clipPath>
                  <radialGradient id="cgd-env-seal" cx="0.38" cy="0.32" r="0.75">
                    <stop offset="0" stopColor="#ff5a64" />
                    <stop offset="0.55" stopColor="#c4010d" />
                    <stop offset="1" stopColor="#6e0008" />
                  </radialGradient>
                </defs>
                {/* The slab's edge, under everything: its thickness. */}
                <rect x="4" y="12.6" width="24" height="15.6" rx="2.6" fill="#4a4351" />
                {/* The inside, and the flap standing open behind the letter. */}
                <path d="M4.6 12.4 16 4.6l11.4 7.8Z" fill="url(#cgd-env-inside)" />
                <rect x="4" y="11.6" width="24" height="15.4" rx="2.6" fill="url(#cgd-env-inside)" />
                {/* The letter, in the mouth. */}
                <g className="cgd-env-letter">
                  <rect x="7.6" y="7.4" width="16.8" height="15" rx="1.3" fill="url(#cgd-env-letter)" />
                  <rect x="10.2" y="10.2" width="7.2" height="1.3" rx="0.65" fill="#c4010d" />
                  <rect x="10.2" y="13" width="11.6" height="1" rx="0.5" fill="#bdb5c2" />
                  <rect x="10.2" y="15.2" width="9.4" height="1" rx="0.5" fill="#bdb5c2" />
                </g>
                {/* The pocket: side folds first, the bottom fold over them. */}
                <g clipPath="url(#cgd-env-clip)">
                  <path d="M4 13.2 14.6 20.6 4 27V13.2Z" fill="url(#cgd-env-side)" />
                  <path d="M28 13.2 17.4 20.6 28 27V13.2Z" fill="url(#cgd-env-side)" />
                  <path d="M4 24.4 16 18.6l12 5.8A2.6 2.6 0 0 1 25.4 27H6.6A2.6 2.6 0 0 1 4 24.4Z" fill="url(#cgd-env-bottom)" />
                  {/* Light catching the folds' edges. */}
                  <path d="M4.4 13.4 14.6 20.6M27.6 13.4 17.4 20.6" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="0.6" strokeLinecap="round" fill="none" />
                  <path d="M4.6 24.3 16 18.8l11.4 5.5" stroke="#ffffff" strokeWidth="0.6" strokeLinecap="round" fill="none" />
                </g>
                {/* The wax seal. */}
                <circle cx="16" cy="19.6" r="2.7" fill="url(#cgd-env-seal)" />
                <circle cx="15.1" cy="18.7" r="0.8" fill="#ffffff" fillOpacity="0.55" />
              </svg>
            </span>
          </a>

          {/* The stamp folder, the pad's right-hand button: the occasion's
              stamps live under the glass (STAMPS) and slide out on hover, when the button becomes the envelope; a click swings
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
              // Open, the pointer is usually on its way to the coloured
              // folders fanned out beside it: give it time to get there.
              apartOff(folderOpen ? SLEEVE_LINGER_MS : APART_LINGER_MS);
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
            onClick={() => {
              // Away from the + dial into the folder's own sub dial, where
              // the subfolders and stamps are big enough to see (client,
              // 3 Oct). The coloured folders here stay shut.
              // One folder all the way: the dock's other icons fade out
              // round it first, then the sub dial's hub takes its place at
              // its exact spot and size and carries it to the corner.
              if (subDial || handoff === "hide") return;
              setSleeveHot(null);
              setSleeveOpen(null);
              setFolderOpen(false);
              setStampHot(false);
              setHandoff("hide");
              window.clearTimeout(handoffTimer.current);
              handoffTimer.current = window.setTimeout(() => {
                setSubFrom(folderRect());
                setSubDial(true);
              }, reducedMotion() ? 0 : HANDOFF_MS);
            }}
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
                setAiActive(true);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "touch") return;
                hoverOff();
                bubbleOff(BUBBLE_LINGER_MS);
                setAiActive(false);
              }}
              onPointerDown={(e) => {
                pressOn("ai")();
                if (e.pointerType === "touch") {
                  // Tap: the bubble up until the next tap or the dock shutting.
                  touchBubble.current = !touchBubble.current;
                  if (touchBubble.current) bubbleOn();
                  else bubbleOff(0);
                  setAiActive(touchBubble.current);
                }
              }}
              onPointerUp={pressOff}
              onFocus={() => {
                bubbleOn();
                setAiActive(true);
              }}
              onBlur={() => {
                bubbleOff(0);
                setAiActive(false);
              }}
            >
              {AI_BUTTON === "veronica" ? (
                <span aria-hidden className="cgd-inner cgd-inner--veronica">
                  {/* Mounted only while the pad is open: its WebGL context
                      and frame loop exist only while it can be seen. */}
                  {open && <VeronicaTile state={aiActive && open ? "listening" : "idle"} />}
                </span>
              ) : (
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
              )}
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
          {/* The folder's 3D file, over the folder while it is the file. */}
          <div ref={fileFrostRef} aria-hidden className="cgd-cube-frost cgd-file-frost" />
          {/* The coloured folders, small, inside the glass: over its frost,
              under the glass itself (FolderStack). */}
          <FolderStack ref={fileStackRef} className="cgd-file-stack" />
          <canvas ref={fileRef} aria-hidden className="cgd-cube cgd-file" width={1} height={1} />
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
      {/* The stamps in their folder. LAST in the stage, and that is the
          whole of why a card is no longer cut in half.

          They used to sit before .cgd-glass, so that the part of a card
          still inside the folder was frosted by the sheet and the part
          that had slid out came sharp. That reads beautifully until the
          folder grew a frost of its own: .cgd-file-frost carries
          backdrop-filter: blur(26px) clipped to the file's silhouette,
          and a backdrop-filter does not blur its backdrop, it REPLACES
          it. Any card lying under that silhouette was swapped for a 26px
          blur of itself under the glass fill — gone, with a knife edge
          along the file's outline. The fanned-out cards overlap the
          folder by about ten pixels, so the card behind the front one
          came out sliced down its right-hand side, perforations and
          shadow missing. z-index cannot save it: Chromium composites the
          frost against the whole backdrop root, so a sibling painted
          later is eaten just the same. Only paint ORDER in the DOM gets a
          card out of that backdrop, which is why this block lives here.

          Its z-index then chooses which world a card is in — see
          .cgd-stamp in corner-dock.css: under the glass while it is
          tucked away, above every frost the moment it moves.

          What comes out is the three COLOURED FOLDERS (SLEEVES), each
          with the stamps inside it. Each folder carries its own fan: how
          far left it goes, its tilt, and its beat — the front one leads
          and lands nearest the file, the ones behind follow a beat later
          and go further, so they land side by side. */}
        {/* className is STATIC: the frame loop toggles .is-in on this span,
            and a className React rewrote (on every hover of a coloured
            folder) wiped it until the loop's next frame — which, with the
            loop asleep, never came. .is-hot / .is-open are set in an
            effect instead (see stampRef). */}
        <span ref={stampRef} aria-hidden className="cgd-stamp">
          {SLEEVES.map((f, i) => {
            const n = SLEEVES.length;
            const depth = n - 1 - i; // 0 = front
            const hotHere = folderOpen && sleeveHot === i;
            const openHere = folderOpen && sleeveOpen === i;
            return (
              <span
                key={i}
                className={`cgd-sleeve${hotHere ? " is-hot" : ""}${openHere ? " is-open" : ""}`}
                style={
                  {
                    "--tint": f.tint,
                    "--edge": f.edge,
                    // Out: STACKED, one on top of the other, beside the file
                    // (client, 26 Sep: "a second layer ... where the coloured
                    // transparent folders are stacked on top of one another"):
                    // each one behind sits higher, so its top edge shows over
                    // the one in front, with a hair of tilt apiece.
                    "--dx": `${-64 - depth * 3}px`,
                    "--dy": `${-2 - depth * 14}px`,
                    "--rot": `${-2 + depth * 2.5}deg`,
                    "--delay": `${depth * 0.07}s`,
                    // How far back in the stack: the spread lifts each one
                    // by this many steps (see .cgd-stamp.is-spread).
                    "--depth": depth,
                    // Tucked: stacked in the file, the ones behind a little
                    // higher so each colour shows at its top edge.
                    "--tx": `${(depth % 2 ? 3 : -2) * Math.min(depth, 1)}px`,
                    "--ty": `${-depth * 4}px`,
                    "--tr": `${(depth % 2 ? 4 : -3) * Math.min(depth, 1)}deg`,

                    // An explicit order, front highest. The fan is drawn back
                    // to front, and DOM order alone stops deciding what lies
                    // over what once they animate: on iOS each is promoted to
                    // its own compositing layer by the move, and the one
                    // BEHIND came out on top (it sliced the stamp's Z in half
                    // when these were bare stamps).
                    "--z": `${10 - depth}`,
                  } as React.CSSProperties
                }
                onPointerEnter={(e) => {
                  if (e.pointerType === "touch") return; // a tap opens instead
                  apartOn();
                  heat();
                  window.clearTimeout(stackTimer.current);
                  setStackHot(true);
                  setSleeveHot(i);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === "touch") return;
                  setSleeveHot((h) => (h === i ? null : h));
                  cool();
                  apartOff(SLEEVE_LINGER_MS);
                  window.clearTimeout(stackTimer.current);
                  stackTimer.current = window.setTimeout(() => setStackHot(false), 260);
                }}
                onClick={() => setSleeveOpen((o) => (o === i ? null : i))}
              >
                <span className="cgd-sleeve-back" />
                {STAMPS.map((s, j) => {
                  const sd = STAMPS.length - 1 - j; // 0 = front stamp
                  return (
                    <span
                      key={j}
                      className="cgd-stamp-card"
                      style={
                        {
                          "--stamp-art": `url("${s.art}")`,
                          "--paper": s.paper ?? "#f4efe3",
                          // Tucked: the front stamp's edge just past the
                          // folder's; the one behind a little further, higher.
                          "--sx0": `${6 + sd * 3}px`,
                          "--sy0": `${1 - sd * 4}px`,
                          "--sr0": `${2 + sd * 5}deg`,
                          // Out: slid from the right-hand edge, the front
                          // one furthest, the one behind peeking over it.
                          "--sx1": `${22 - sd * 6}px`,
                          "--sy1": `${-2 - sd * 7}px`,
                          "--sr1": `${9 + sd * 6}deg`,
                          "--sdelay": `${sd * 0.05}s`,
                          "--z": `${5 - sd}`,
                        } as React.CSSProperties
                      }
                    >
                      <span className="cgd-stamp-paper">
                        <span className="cgd-stamp-art" />
                      </span>
                    </span>
                  );
                })}
                <span className="cgd-sleeve-front" />
              </span>
            );
          })}
        </span>

      </div>
      <FolderSubDial
        open={subDial}
        from={subFrom}
        home={folderRect}
        onLeaving={(kind) => {
          // Closing altogether: the hidden dock folds up while the folders
          // go in, so it is shut by the time it shows again.
          if (kind === "close") {
            openRef.current = false;
            setOpen(false);
          }
        }}
        onBack={handBack}
        onClose={handBack}
      />
    </>
  );
}
