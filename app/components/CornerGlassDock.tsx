"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { LiquidField, type FieldBody } from "./liquidField";
import { subscribeGlassCube } from "./ChromaticMetal";
import "@/app/styles/corner-dock.css";

/* The dock is a visitor, not a fixture: it first appears a while after
   the loader's reveal, stays up for a stretch, then slips away and
   returns later — until the user clicks it once, after which it stays. */
const FIRST_DELAY_MS = 6_000;
const SHOWN_MS = 14_000;
const HIDDEN_MS = 20_000;
/* How long the + stays after the pointer leaves the corner, so a hand
   that wandered off the ripple can come back for it. */
const HOT_LINGER_MS = 1_500;
/* The second box leaves the seed this much after the first, so the body
   stretches into a column before it starts to pinch — the film's blob
   elongates first and necks second. */
const SECOND_BOX_DELAY_MS = 70;
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
  { art: "/hongkongmapicon.png" },
  { art: "/AI-9-cursor.png" },
];
const STAMP_W = 30;
const STAMP_H = 40;
/* How long a tap (no hover on touch) keeps the stamps out. */
const STAMP_TAP_MS = 2_600;
/* The folder itself, per the client's film (Screen Recording 2026-09-08
   070238): once the halves part, the folder half is not a square but a
   portrait envelope — taller than wide, tighter corners — with a small
   label at its foot. Hover it and one stamp peeks out; click it and its
   front swings open about its edge to show what is inside. Edit the label
   with the stamps. */
/* 50x62 is the film's portrait (0.8), sized so the envelope keeps clear
   of the pill above and the bubble's row below: bodies within ~8px of each
   other grow a neck. */
const FOLDER_W = 50;
const FOLDER_H = 62;
const FOLDER_R = 11;
const FOLDER_LABEL = { title: "Zuhayr", sub: "Archive" };

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
/* Resting gap between boxes. The goo scale at rest (S_REST) must be well
   under GAP / 1.4, or the boxes would keep a neck between them. */
const GAP = 16;
/* The tools box is TWO bodies, the folder slot and the AI slot, each the
   seed's size. Joined, their centres sit JOIN apart (an 8px overlap of
   two 16px-cornered squares leaves a notch under a pixel deep, which the
   goo fills: one 96px box). Hover the box and the folder is pulled left
   to APART, where a neck forms between the two and snaps, per the film;
   leave the box and it is let back, and they merge. */
const JOIN = 44;
/* Far enough that the bubble dropping from the AI half clears the
   envelope's corner: bodies within ~8px of each other grow a neck. */
const APART = 78;
const TOOL_W = JOIN + SEED;
const TOOL_H = SEED;
/* How long after the pointer leaves the box the halves are let merge. */
const APART_LINGER_MS = 160;
const APART_TAP_MS = 2_600;
const CTA_H = 44;
/* The AI slot's "coming soon" bubble: a pill in the row of the ×, to its
   left, budded off the pixelated box above it. Its height is the circle
   it forms as first. */
const BUBBLE_H = 40;
/* How long the bubble stays after the pointer leaves the AI slot, and
   how long a tap on it (no hover on touch) keeps it out. */
const BUBBLE_LINGER_MS = 500;
const BUBBLE_TAP_MS = 2_600;

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
  seed: { x: number; y: number };
  /** The two halves of the tools box, joined; the folder pulls left of
      this when the box is hovered. */
  folder: { x: number; y: number };
  cta: { x: number; y: number };
  /** The AI slot's centre, where the bubble is born. */
  ai: { x: number; y: number };
  /** The bubble's resting centre, and its right end: the circle it forms
      as first sits there, under the AI slot, before stretching left. */
  bubble: { x: number; y: number; right: number };
}

function layoutFor(ctaW: number, bubbleW: number): Layout {
  const W = PAD_LEFT + Math.max(ctaW, TOOL_W, SEED + GAP + bubbleW) + EDGE;
  const H = PAD_TOP + CTA_H + GAP + TOOL_H + GAP + SEED + EDGE;
  const RX = W - EDGE;
  const seed = { x: RX - SEED / 2, y: H - EDGE - SEED / 2 };
  const rowY = seed.y - SEED / 2 - GAP - TOOL_H / 2;
  const cta = { x: RX - ctaW / 2, y: rowY - TOOL_H / 2 - GAP - CTA_H / 2 };
  /* The AI slot is the RIGHT half of the tools box; the folder is the
     left, so its stamps slide out into open space. */
  const ai = { x: RX - SEED / 2, y: rowY };
  const folder = { x: ai.x - JOIN, y: rowY };
  const right = RX - SEED - GAP;
  const bubble = { x: right - bubbleW / 2, y: seed.y, right };
  return { W, H, seed, folder, cta, ai, bubble };
}

type Vec5 = readonly [number, number, number, number, number];

/** One box: a 5-way spring (x, y, w, h, r) and the field body it drives. */
class Slot {
  cur = new Float64Array(5);
  vel = new Float64Array(5);
  tgt = new Float64Array(5);
  speed = 0;
  body: FieldBody = { x: 0, y: 0, w: 0, h: 0, r: 0, wob: 0, s: S_REST };
  /** Position speed alone (px/s); `speed` also counts size change. */
  travel = 0;
  /* A body can be sent somewhere VIA a waypoint: it springs to `via`
     until `until` says so, then on to its destination. That is how a
     box travels as a slender drop and only widens where it lands, and
     how the bubble forms as a circle before it stretches into a pill:
     the film's body buds off round and fills out in place. */
  private dest = new Float64Array(5);
  private via: Float64Array | null = null;
  private until: ((s: Slot) => boolean) | null = null;

  snap(v: Vec5) {
    this.cur.set(v);
    this.tgt.set(v);
    this.dest.set(v);
    this.via = null;
    this.vel.fill(0);
  }
  aim(v: Vec5, via?: Vec5, until?: (s: Slot) => boolean) {
    // Every hover change re-aims every body, so this is called far more
    // often than a destination changes. The same destination again keeps
    // whatever leg the body is on — whether it has passed its waypoint
    // or not — rather than starting the route over: sending a body that
    // had already arrived back through its waypoint is how the bubble's
    // exit came to play twice. And a waypoint is for a journey; a body
    // already close to a (slightly) new destination, such as one that
    // just swelled 4px on hover, goes straight there.
    if (this.dest.every((d, i) => d === v[i])) return;
    this.dest.set(v);
    const close =
      Math.abs(this.cur[0] - v[0]) < 24 && Math.abs(this.cur[1] - v[1]) < 24;
    if (via && until && !close) {
      this.via = new Float64Array(via);
      this.until = until;
      this.tgt.set(via);
    } else {
      this.via = null;
      this.tgt.set(v);
    }
  }
  /** At a waypoint whose condition now holds: take the next leg. True if
      there was one to take. */
  onward() {
    if (this.via && this.until && this.until(this)) {
      this.via = null;
      this.tgt.set(this.dest);
      return true;
    }
    return false;
  }
  step(dt: number) {
    const { cur, vel, tgt } = this;
    this.onward();
    for (let i = 0; i < 5; i++) {
      vel[i] += (K * (tgt[i] - cur[i]) - DAMP * vel[i]) * dt;
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
  /** The tools box: the hover zone spanning both halves and the gap. */
  tools: HTMLDivElement;
  folder: HTMLDivElement;
  /** The folder's front, which swings open on click. */
  flap: HTMLDivElement;
  ai: HTMLButtonElement;
  stamp: HTMLSpanElement;
  bubble: HTMLSpanElement;
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
  /** The tools box is hovered: its two halves are held apart. */
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
  private openTimer = 0;
  private closeTimer = 0;
  private hideTimer = 0;
  /* Whether the seed was there last frame — the sink's end is the moment
     it stops being, and that is when the pond closes over it. */
  private hadSeed = false;
  private lastOpen = false;
  private dead = false;

  constructor(
    private readonly els: DockEls,
    private readonly layout: Layout,
    private readonly ctaW: number,
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
    ];
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const parked = this.parked();
    this.seed.snap(parked);
    this.cta.snap(parked);
    this.folder.snap(parked);
    this.ai.snap(parked);
    this.bubble.snap(parked);
    this.retarget();
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.openTimer);
    window.clearTimeout(this.closeTimer);
    window.clearTimeout(this.hideTimer);
  }

  /** Update any part of the intent and re-aim the springs. */
  set(patch: Partial<Intent>) {
    Object.assign(this.intent, patch);
    this.retarget();
  }

  /* The seed's parking spot: its own centre, at no size. The drop rises
     out of that point when the corner is hovered, the way a stone in a
     pond throws one up, and sinks back into it on hide. */
  private parked(): Vec5 {
    const L = this.layout;
    return [L.seed.x, L.seed.y, 0, 0, 0];
  }

  private retarget() {
    const L = this.layout;
    const { visible, open, hover, press } = this.intent;
    const bump = (which: Which) =>
      (hover === which ? SWELL : 0) + (press === which ? PRESS : 0);

    // A small core swells less, or the cube would balloon on hover.
    const size = this.cube ? CORE + bump("seed") * 0.5 : SEED + bump("seed");
    const seedAt: Vec5 = visible
      ? [L.seed.x, L.seed.y, size, size, this.cube ? CORE_R : BOX_R]
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

    const ctaAt: Vec5 = [
      L.cta.x,
      L.cta.y,
      this.ctaW + bump("cta"),
      CTA_H + bump("cta"),
      CTA_H / 2,
    ];
    // The folder half sits joined to the AI half as a square, or pulled
    // APART while the box is hovered — and then it is the envelope: taller
    // than wide, tighter corners. The AI half holds its place at the edge.
    const { apart } = this.intent;
    const folderAt: Vec5 = apart
      ? [
          L.folder.x - (APART - JOIN),
          L.folder.y,
          FOLDER_W + bump("folder") * 0.5,
          FOLDER_H + bump("folder") * 0.5,
          FOLDER_R,
        ]
      : [L.folder.x, L.folder.y, SEED + bump("folder"), SEED + bump("folder"), BOX_R];
    const aiAt: Vec5 = [L.ai.x, L.ai.y, SEED + bump("ai"), SEED + bump("ai"), BOX_R];
    if (open) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = 0;
      // A box climbs as a drop the seed's width and widens over the last
      // third of the climb (never less than 30px, so the short hop still
      // gets its bud).
      const slender = (slot: Slot, at: Vec5) => {
        const narrow: Vec5 = [at[0], at[1], Math.min(at[2], SEED), at[3], at[4]];
        const widenAt = Math.max(30, 0.33 * Math.abs(slot.cur[1] - at[1]));
        slot.aim(at, narrow, (b) => Math.abs(b.cur[1] - at[1]) < widenAt);
      };
      slender(this.cta, ctaAt);
      if (!this.lastOpen) {
        // Freshly opened: the tools box waits its beat inside the seed.
        window.clearTimeout(this.openTimer);
        this.openTimer = window.setTimeout(() => {
          this.openTimer = 0;
          slender(this.folder, folderAt);
          slender(this.ai, aiAt);
          this.wake();
        }, SECOND_BOX_DELAY_MS);
      } else if (!this.openTimer) {
        slender(this.folder, folderAt);
        slender(this.ai, aiAt);
      }
    } else {
      window.clearTimeout(this.openTimer);
      this.openTimer = 0;
      // Shut, the boxes live inside the seed, wherever it is — and with
      // the cube standing in for the seed's body, at its centre at no
      // size, or they would show as a small disc under the cube. Just
      // shut, the content gets its beat to dissolve first; a hover or
      // press arriving during that beat must not cut it short.
      const inside: Vec5 = this.cube ? [seedAt[0], seedAt[1], 0, 0, 0] : seedAt;
      const park = () => {
        this.cta.aim(inside);
        this.folder.aim(inside);
        this.ai.aim(inside);
      };
      if (this.lastOpen) {
        window.clearTimeout(this.closeTimer);
        this.closeTimer = window.setTimeout(() => {
          this.closeTimer = 0;
          park();
          this.wake();
        }, CLOSE_DELAY_MS);
      } else if (!this.closeTimer) {
        park();
      }
    }
    this.lastOpen = open;

    // The bubble. Out: born at the AI slot's centre, it drops as a growing
    // bead to the row of the ×, forms a proper CIRCLE there under the
    // slot, stills, and only then stretches left into its pill: the
    // film's circle-then-pill. In: the pill draws back into that circle,
    // then rises into the slot and is gone. Parked, it is a point inside
    // the tools box, wherever that is.
    const circle: Vec5 = [
      L.bubble.right - BUBBLE_H / 2,
      L.bubble.y,
      BUBBLE_H,
      BUBBLE_H,
      BUBBLE_H / 2,
    ];
    const formed = (b: Slot) => b.home(3, 120);
    if (open && this.intent.bubble) {
      this.bubble.aim(
        [L.bubble.x, L.bubble.y, this.bubbleW, BUBBLE_H, BUBBLE_H / 2],
        circle,
        formed
      );
    } else {
      // Where it goes. Shut, into the seed. Open, it is BORN at the AI
      // slot's centre (from the layout, not the tools box's own spring
      // target, which at the moment of opening is still the seed) — but it
      // does not go back there: a pill that is out draws back into its
      // circle and sinks away where it is, as the seed does, rather than
      // travelling back up past the envelope's corner and necking to it.
      const wasOut = this.bubble.cur[2] > BUBBLE_H + 6;
      const sunk: Vec5 = [circle[0], circle[1], 0, 0, 0];
      const home: Vec5 = open
        ? wasOut || this.bubble.cur[2] > 4
          ? sunk
          : [L.ai.x, L.ai.y, 0, 0, 0]
        : [seedAt[0], seedAt[1], 0, 0, 0];
      if (wasOut) this.bubble.aim(home, circle, formed);
      else this.bubble.aim(home);
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
    const slots = [this.seed, this.cta, this.folder, this.ai, this.bubble];
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
    this.inherit();
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
      own(this.ai)
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
    const { seed, cta, tools, folder, flap, ai, stamp, bubble, cube, cubeFrost, cubeSil } =
      this.els;
    const seedB = this.seed.body;
    const ctaB = this.cta.body;
    const folderB = this.folder.body;
    const aiB = this.ai.body;
    const bubbleB = this.bubble.body;
    const at = (el: HTMLElement, x: number, y: number) => {
      el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    };
    at(seed, seedB.x - SEED / 2, seedB.y - SEED / 2);
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
    at(cta, ctaB.x - this.ctaW / 2, ctaB.y - CTA_H / 2);
    // The tools zone spans from the folder half to the AI half, gap and
    // all, so the pointer can cross between them without leaving it. Its
    // origin is the folder's top-left; the folder slot fills the folder's
    // body (which is a square joined and an envelope apart), the AI slot
    // rides its own body, and the front (the flap) sits over the folder.
    const fw = Math.max(0, this.folder.cur[2]);
    const fh = Math.max(0, this.folder.cur[3]);
    const fr = Math.max(0, this.folder.cur[4]);
    const zx = folderB.x - fw / 2;
    const zy = Math.min(folderB.y - fh / 2, aiB.y - SEED / 2);
    at(tools, zx, zy);
    tools.style.width = `${Math.max(fw, aiB.x + SEED / 2 - zx).toFixed(2)}px`;
    tools.style.height = `${Math.max(fh, aiB.y + SEED / 2 - zy).toFixed(2)}px`;
    at(folder, 0, folderB.y - fh / 2 - zy);
    folder.style.width = `${fw.toFixed(2)}px`;
    folder.style.height = `${fh.toFixed(2)}px`;
    folder.style.borderRadius = `${fr.toFixed(2)}px`;
    at(ai, aiB.x - SEED / 2 - zx, aiB.y - SEED / 2 - zy);
    // The flap keeps its transform for the swing, so it is placed by
    // left/top instead.
    flap.style.left = `${zx.toFixed(2)}px`;
    flap.style.top = `${(folderB.y - fh / 2).toFixed(2)}px`;
    flap.style.width = folder.style.width;
    flap.style.height = folder.style.height;
    flap.style.borderRadius = folder.style.borderRadius;
    tools.classList.toggle("is-apart", this.intent.apart && this.folder.arrived(6));
    at(bubble, bubbleB.x - this.bubbleW / 2, bubbleB.y - BUBBLE_H / 2);
    // The stamps sit centred in the folder, a little high once it is the
    // envelope, to leave the label its foot.
    at(stamp, folderB.x - STAMP_W / 2, folderB.y - STAMP_H / 2 - (this.intent.apart ? 5 : 0));

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
 * welling out of the bottom-right corner, occasionally (see the timing
 * constants). Hover the corner and the + box slides in off the edge of
 * the screen; click it and the box splits, liquid-glass fashion, into
 * two more boxes standing above it — the start-a-project pill and the
 * tools box (the AI doorway and the stamp folder in one body) — while
 * the + turns into a × and stays. The glass is one clipped sheet whose
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
  // CTAs there. Any element tagged data-corner-dock-avoid that's in the
  // viewport suppresses the dock, so it never sits on top of one.
  const [clear, setClear] = useState(true);
  // The stamps are being coaxed out of their folder.
  const [stampHot, setStampHot] = useState(false);
  // The folder's front: open on a click, shut when the box is left or the
  // dock shuts.
  const [folderOpen, setFolderOpen] = useState(false);
  const stampTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(stampTimer.current), []);
  // Counts the drop's sinkings; each one closes the pond with a ring (the
  // key restarts the animation).
  const [splash, setSplash] = useState(0);
  // The pill's width comes from its label; measured, then the stage is
  // laid out around it.
  const [ctaW, setCtaW] = useState(0);
  const [bubbleW, setBubbleW] = useState(0);

  // Refs mirror state for the timer chain, which outlives any one render.
  const openRef = useRef(false);
  const engagedRef = useRef(false);

  useEffect(() => {
    const rivals = document.querySelectorAll("[data-corner-dock-avoid]");
    if (rivals.length === 0) return;
    const onScreen = new Set<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) onScreen.add(e.target);
        else onScreen.delete(e.target);
      }
      setClear(onScreen.size === 0);
    });
    rivals.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let timer = 0;

    const appear = () => {
      setShown(true);
      timer = window.setTimeout(retire, SHOWN_MS);
    };
    const retire = () => {
      // Clicked once (or currently open): the dock has earned its place —
      // stop the hide/show cycle and just stay.
      if (openRef.current || engagedRef.current) return;
      setShown(false);
      timer = window.setTimeout(appear, HIDDEN_MS);
    };
    const start = () => {
      timer = window.setTimeout(appear, FIRST_DELAY_MS);
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
  // it stays even over a rival — the user asked for it. The ripple runs on
  // its occasional cycle whenever the corner is clear and the dock is shut.
  const visible = open || ((hot || engaged) && clear);
  const rippling = shown && clear && !open;

  /* ── DOM the frame loop writes to ── */
  const stageRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const silRef = useRef<SVGPathElement>(null);
  const seedRef = useRef<HTMLButtonElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const folderRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<HTMLButtonElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const cubeRef = useRef<HTMLCanvasElement>(null);
  const cubeFrostRef = useRef<HTMLDivElement>(null);
  const cubeSilRef = useRef<SVGPathElement>(null);
  // The cube's lean towards the pointer; set once the cube is live.
  const cubeTilt = useRef<((x: number, y: number) => void) | null>(null);

  // Measure the pill and the bubble; again once the fonts are in, which
  // can widen them.
  useLayoutEffect(() => {
    const measure = () => {
      if (ctaRef.current) setCtaW(Math.ceil(ctaRef.current.offsetWidth));
      if (bubbleRef.current) setBubbleW(Math.ceil(bubbleRef.current.offsetWidth));
    };
    measure();
    document.fonts?.ready.then(measure);
  }, []);

  /* ── The simulation ──
     A DockSim owns the springs, the field and the frame loop, and writes
     straight to the DOM; React only hands it intent. Rebuilt when the
     layout changes (the pill's width). */
  const simRef = useRef<DockSim | null>(null);
  useEffect(() => {
    if (!ctaW || !bubbleW) return;
    const els = {
      stage: stageRef.current,
      glass: glassRef.current,
      sil: silRef.current,
      seed: seedRef.current,
      cta: ctaRef.current,
      tools: toolsRef.current,
      folder: folderRef.current,
      flap: flapRef.current,
      ai: aiRef.current,
      stamp: stampRef.current,
      bubble: bubbleRef.current,
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
      layoutFor(ctaW, bubbleW),
      ctaW,
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
  }, [ctaW, bubbleW]);

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
  }, [ctaW, bubbleW, visible, open]);

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

  // The tools box's halves are held apart while the pointer is over the
  // box (either half or the gap between), and let merge a beat after it
  // leaves; a tap holds them apart a while on touch.
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
  useEffect(() => () => window.clearTimeout(apartTimer.current), []);

  const L = layoutFor(Math.max(ctaW, 1), Math.max(bubbleW, 1));
  const sx = L.seed.x;
  const sy = L.seed.y;

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
        className={`cgd-stage ${open ? "is-open" : ""} ${rippling ? "is-rippling" : ""}`}
        style={{ width: L.W, height: L.H }}
      >
        {/* Beneath the glass: the silhouette's definitions and its shadow. */}
        <svg
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
            <filter id="cgd-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="9" />
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
                    "--dy": `${-4 + depth * 6}px`,
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
          aria-hidden
          className="cgd-svg"
          width={L.W}
          height={L.H}
          viewBox={`0 0 ${L.W} ${L.H}`}
        >
          <g className="cgd-ripple">
            {[0, 1, 2].map((i) => (
              <g key={i} className="cgd-ring" style={{ transformOrigin: `${sx}px ${sy}px` }}>
                <circle className="cgd-ring-trough" cx={sx} cy={sy} r={SEED / 2 + 1.5} />
                <circle className="cgd-ring-crest" cx={sx} cy={sy} r={SEED / 2} />
              </g>
            ))}
            {/* The pond closing over the sunk drop: one ring, once. */}
            {splash > 0 && (
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
        </svg>

        {/* Content, riding its bodies. */}
        <div className="cgd-content">
          <a
            ref={ctaRef}
            className={`cgd-body cgd-cta ${open ? "is-live" : ""}`}
            href="/contact"
            tabIndex={open ? 0 : -1}
            aria-hidden={!open}
            onPointerEnter={hoverOn("cta")}
            onPointerLeave={hoverOff}
            onPointerDown={pressOn("cta")}
            onPointerUp={pressOff}
          >
            <span className="cgd-inner">
              Start a project{" "}
              <span aria-hidden className="cgd-arrow">
                &rarr;
              </span>
            </span>
          </a>

          {/* The tools box: two slots that are one body of glass until the
              box is hovered, when the folder half is pulled off the AI
              half, liquid-fashion, and stays off while the pointer is over
              either half or the gap; leave, and they merge. This element
              is the hover zone spanning both, sized per frame. Left: the
              stamp folder — the occasion's stamps live under the glass
              (STAMPS) and slide out leftwards on hover. Right: the red LED
              matrix, the future doorway to the AI bot (destination not
              built yet — wire its onClick when the AI page exists); its
              "coming soon" bubble drops from it. */}
          <div
            ref={toolsRef}
            className={`cgd-body cgd-tools ${open ? "is-live" : ""}`}
            aria-hidden={!open}
            onPointerEnter={() => {
              heat();
              apartOn();
            }}
            onPointerLeave={() => {
              cool();
              apartOff(APART_LINGER_MS);
            }}
            onPointerDown={(e) => {
              if (e.pointerType === "touch") {
                apartOn();
                apartOff(APART_TAP_MS);
              }
            }}
          >
            <div
              ref={folderRef}
              className="cgd-slot cgd-folder"
              aria-hidden
              onPointerEnter={() => {
                hoverOn("folder")();
                window.clearTimeout(stampTimer.current);
                setStampHot(true);
              }}
              onPointerLeave={() => {
                hoverOff();
                setStampHot(false);
              }}
              onPointerDown={(e) => {
                pressOn("folder")();
                if (e.pointerType === "touch") {
                  setStampHot(true);
                  window.clearTimeout(stampTimer.current);
                  stampTimer.current = window.setTimeout(() => setStampHot(false), STAMP_TAP_MS);
                }
              }}
              onPointerUp={pressOff}
              onClick={() => setFolderOpen((v) => !v)}
            >
              {/* The envelope's label, at its foot, once it is one. */}
              <span className="cgd-folder-label">
                <b>{FOLDER_LABEL.title}</b>
                <i>{FOLDER_LABEL.sub}</i>
              </span>
            </div>
            <button
              ref={aiRef}
              type="button"
              className="cgd-slot cgd-ai"
              tabIndex={open ? 0 : -1}
              aria-label="Zuhayr AI — coming soon"
              onPointerEnter={() => {
                hoverOn("ai")();
                bubbleOn();
              }}
              onPointerLeave={() => {
                hoverOff();
                bubbleOff(BUBBLE_LINGER_MS);
              }}
              onPointerDown={(e) => {
                pressOn("ai")();
                if (e.pointerType === "touch") {
                  bubbleOn();
                  bubbleOff(BUBBLE_TAP_MS);
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
          </div>

          {/* The folder's front: the same glass as the folder, sitting over
              it, that swings open about its left edge on a click to show
              what is inside, and shuts again. Placed and sized with the
              folder each frame; unseen unless open or closing. */}
          <div
            ref={flapRef}
            aria-hidden
            className={`cgd-flap liquid-glass ${folderOpen ? "is-open" : ""}`}
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
            <span aria-hidden className="cgd-plus cgd-inner">
              +
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
