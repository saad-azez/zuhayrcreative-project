"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { LiquidField, type FieldBody } from "./liquidField";
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

/* The artwork on the occasion stamp (see the folder slot below and
   .cgd-stamp in the CSS). The cursor's emblem is the placeholder; swap
   this for a seasonal mark or event artwork — anything that reads at
   ~17px on a cream stamp — and the folder does the rest. */
const STAMP_ART = "/AI-9-cursor.png";

/* ── Geometry (CSS px) ──
   The seed is the + box, 18px in from the corner (that margin lives in
   the CSS offsets of .cgd-stage and .cgd-corner). The stage that holds
   the glass extends EDGE past it, room for the shadow. */
const EDGE = 26;
const PAD_LEFT = 34;
const PAD_TOP = 34;
const SEED = 52;
const BOX_R = 16;
/* Resting gap between boxes. The goo scale at rest (S_REST) must be well
   under GAP / 1.4, or the boxes would keep a neck between them. */
const GAP = 16;
const TOOL_W = 112;
const TOOL_H = 52;
const CTA_H = 44;

/* ── Motion ──
   Every box is a damped spring on (x, y, w, h, r). ZETA under 1 gives the
   film's overshoot — the bodies land a hair past their place and ease
   back. The goo scale s runs from S_REST when still to S_FLOW at full
   speed: stringy while the bodies fly (a neck holds until ~20px of gap)
   and crisp once they stop, which is what pinches the neck. Surface
   waves and the along-motion stretch are likewise speed-driven, so a
   resting body is a clean rectangle. */
const K = 130;
const ZETA = 0.72;
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
  tools: { x: number; y: number };
  cta: { x: number; y: number };
}

function layoutFor(ctaW: number): Layout {
  const W = PAD_LEFT + Math.max(ctaW, TOOL_W) + EDGE;
  const H = PAD_TOP + CTA_H + GAP + TOOL_H + GAP + SEED + EDGE;
  const RX = W - EDGE;
  const seed = { x: RX - SEED / 2, y: H - EDGE - SEED / 2 };
  const tools = { x: RX - TOOL_W / 2, y: seed.y - SEED / 2 - GAP - TOOL_H / 2 };
  const cta = { x: RX - ctaW / 2, y: tools.y - TOOL_H / 2 - GAP - CTA_H / 2 };
  return { W, H, seed, tools, cta };
}

type Vec5 = readonly [number, number, number, number, number];

/** One box: a 5-way spring (x, y, w, h, r) and the field body it drives. */
class Slot {
  cur = new Float64Array(5);
  vel = new Float64Array(5);
  tgt = new Float64Array(5);
  speed = 0;
  body: FieldBody = { x: 0, y: 0, w: 0, h: 0, r: 0, wob: 0 };
  /* A box travels as a drop the seed's width and only widens into its
     own shape once it is within `widenAt` px of its place — the film's
     body buds off slender and fills out where it lands. `wideW` is the
     width it widens to; Infinity for widenAt means at once. */
  wideW = 0;
  widenAt = Infinity;

  snap(v: Vec5) {
    this.cur.set(v);
    this.tgt.set(v);
    this.vel.fill(0);
  }
  aim(v: Vec5, widenAt = Infinity) {
    this.tgt.set(v);
    this.wideW = v[2];
    this.widenAt = widenAt;
  }
  step(dt: number) {
    const { cur, vel, tgt } = this;
    tgt[2] = Math.abs(cur[1] - tgt[1]) < this.widenAt ? this.wideW : Math.min(this.wideW, SEED);
    for (let i = 0; i < 5; i++) {
      vel[i] += (K * (tgt[i] - cur[i]) - DAMP * vel[i]) * dt;
      cur[i] += vel[i] * dt;
    }
    /* Size change counts as motion too, at half weight: a box swelling
       into a pill ripples like one travelling. */
    this.speed = Math.hypot(vel[0], vel[1], vel[2] * 0.5, vel[3] * 0.5);
  }
  settled() {
    const { cur, vel, tgt } = this;
    for (let i = 0; i < 5; i++) {
      if (Math.abs(vel[i]) > 1.5 || Math.abs(tgt[i] - cur[i]) > 0.25) return false;
    }
    return true;
  }
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
  /** Derive the field body: speed-driven stretch along the motion and
      skin waves, none of it at rest. */
  derive() {
    const { cur, vel, body } = this;
    const st = Math.min(0.3, this.speed * 0.0005);
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
    body.wob = Math.min(2.2, this.speed * 0.004);
  }
}

type Which = "seed" | "cta" | "tools";

interface DockEls {
  stage: HTMLDivElement;
  glass: HTMLDivElement;
  sil: SVGPathElement;
  seed: HTMLButtonElement;
  cta: HTMLAnchorElement;
  tools: HTMLDivElement;
  stamp: HTMLSpanElement;
}

interface Intent {
  visible: boolean;
  open: boolean;
  hover: Which | null;
  press: Which | null;
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
  private readonly tools = new Slot();
  private readonly bodies: FieldBody[];
  private readonly reduced: boolean;
  private readonly intent: Intent = { visible: false, open: false, hover: null, press: null };
  private raf = 0;
  private last = 0;
  private openTimer = 0;
  private closeTimer = 0;
  private hideTimer = 0;
  /* Whether glass was painted last frame — the sink's end is the moment
     it stops being, and that is when the pond closes over it. */
  private hadGlass = false;
  private lastOpen = false;
  private dead = false;

  constructor(
    private readonly els: DockEls,
    private readonly layout: Layout,
    private readonly ctaW: number,
    /** Called the moment the drop has sunk away: the pond closes. */
    private readonly onSunk: () => void
  ) {
    this.field = new LiquidField(layout.W, layout.H, 2);
    this.bodies = [this.seed.body, this.cta.body, this.tools.body];
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const parked = this.parked();
    this.seed.snap(parked);
    this.cta.snap(parked);
    this.tools.snap(parked);
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

    const seedAt: Vec5 = visible
      ? [L.seed.x, L.seed.y, SEED + bump("seed"), SEED + bump("seed"), BOX_R]
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
    const toolsAt: Vec5 = [
      L.tools.x,
      L.tools.y,
      TOOL_W + bump("tools"),
      TOOL_H + bump("tools"),
      BOX_R,
    ];
    if (open) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = 0;
      // Widen over the last third of the climb, and never less than 30px
      // so the short hop still gets its bud.
      const widenAt = (slot: Slot, y: number) =>
        Math.max(30, 0.33 * Math.abs(slot.cur[1] - y));
      this.cta.aim(ctaAt, widenAt(this.cta, L.cta.y));
      if (!this.lastOpen) {
        // Freshly opened: the tools box waits its beat inside the seed.
        window.clearTimeout(this.openTimer);
        this.openTimer = window.setTimeout(() => {
          this.openTimer = 0;
          this.tools.aim(toolsAt, widenAt(this.tools, L.tools.y));
          this.wake();
        }, SECOND_BOX_DELAY_MS);
      } else if (!this.openTimer) {
        this.tools.aim(toolsAt, widenAt(this.tools, L.tools.y));
      }
    } else {
      window.clearTimeout(this.openTimer);
      this.openTimer = 0;
      // Shut, the boxes live inside the seed, wherever it is. Just shut,
      // the content gets its beat to dissolve first; a hover or press
      // arriving during that beat must not cut it short.
      const park = () => {
        this.cta.aim(seedAt);
        this.tools.aim(seedAt);
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
    const slots = [this.seed, this.cta, this.tools];
    let maxSpeed = 0;
    let settled = true;
    for (const slot of slots) {
      if (this.reduced) {
        slot.cur.set(slot.tgt);
        slot.vel.fill(0);
        slot.speed = 0;
      } else {
        slot.step(dt);
      }
      if (slot.speed > maxSpeed) maxSpeed = slot.speed;
      if (!slot.settled()) settled = false;
      slot.derive();
    }
    if (settled) {
      for (const slot of slots) {
        slot.cur.set(slot.tgt);
        slot.vel.fill(0);
        slot.speed = 0;
        slot.derive();
      }
      // Away and still: paint nothing, so nothing is composited while the
      // dock waits.
      const { visible, open } = this.intent;
      this.paint(visible || open ? this.field.path(this.bodies, S_REST, now / 1000) : "");
      this.ride();
      return;
    }
    const goo = S_REST + (S_FLOW - S_REST) * Math.min(1, maxSpeed / FULL_SPEED);
    this.paint(this.field.path(this.bodies, goo, now / 1000));
    this.ride();
    this.raf = requestAnimationFrame(this.tick);
  };

  private paint(d: string) {
    const { glass, sil, stage } = this.els;
    glass.style.clipPath = d ? `path("${d}")` : 'path("M-9 -9Z")';
    sil.setAttribute("d", d || "M-9 -9");
    stage.classList.toggle("is-glass", d.length > 0);
    // The frame the glass stops being is the moment the drop has sunk —
    // the spring goes on settling about zero for a while after, unseen.
    if (this.hadGlass && !d) this.onSunk();
    this.hadGlass = d.length > 0;
  }

  /** Content rides its body, and surfaces once the body is (nearly) home. */
  private ride() {
    const { seed, cta, tools, stamp } = this.els;
    const seedB = this.seed.body;
    const ctaB = this.cta.body;
    const toolsB = this.tools.body;
    const at = (el: HTMLElement, x: number, y: number) => {
      el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
    };
    at(seed, seedB.x - SEED / 2, seedB.y - SEED / 2);
    at(cta, ctaB.x - this.ctaW / 2, ctaB.y - CTA_H / 2);
    at(tools, toolsB.x - TOOL_W / 2, toolsB.y - TOOL_H / 2);
    // The stamp sits centred in the folder slot, the right half of the
    // tools box (25×30 paper).
    at(stamp, toolsB.x + TOOL_W / 2 - SEED / 2 - 12.5, toolsB.y - 15);

    const { visible, open } = this.intent;
    const flag = (el: HTMLElement, on: boolean) => {
      const v = on ? "1" : "0";
      if (el.dataset.in !== v) el.dataset.in = v;
    };
    // The + pops up only once the drop has formed and stilled — near its
    // size AND slow, or it would fire on the way up through the overshoot.
    flag(seed, visible && this.seed.home(4, 90));
    flag(cta, open && this.cta.near(9));
    const toolsIn = open && this.tools.near(9);
    flag(tools, toolsIn);
    stamp.classList.toggle("is-in", toolsIn);
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
  // The stamp is being coaxed out of its folder.
  const [stampHot, setStampHot] = useState(false);
  // Counts the drop's sinkings; each one closes the pond with a ring (the
  // key restarts the animation).
  const [splash, setSplash] = useState(0);
  // The pill's width comes from its label; measured, then the stage is
  // laid out around it.
  const [ctaW, setCtaW] = useState(0);

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
  const stampRef = useRef<HTMLSpanElement>(null);

  // Measure the pill; again once the fonts are in, which can widen it.
  useLayoutEffect(() => {
    const measure = () => {
      const el = ctaRef.current;
      if (el) setCtaW(Math.ceil(el.offsetWidth));
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
    if (!ctaW) return;
    const els = {
      stage: stageRef.current,
      glass: glassRef.current,
      sil: silRef.current,
      seed: seedRef.current,
      cta: ctaRef.current,
      tools: toolsRef.current,
      stamp: stampRef.current,
    };
    if (!els.stage || !els.glass || !els.sil || !els.seed || !els.cta || !els.tools || !els.stamp) {
      return;
    }
    const sim = new DockSim(els as DockEls, layoutFor(ctaW), ctaW, () =>
      setSplash((n) => n + 1)
    );
    simRef.current = sim;
    return () => {
      sim.destroy();
      simRef.current = null;
    };
  }, [ctaW]);

  // React's intent → the springs.
  useEffect(() => {
    simRef.current?.set({ visible, open });
  }, [ctaW, visible, open]);

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

  const L = layoutFor(Math.max(ctaW, 1));
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
            {/* Rim light: the silhouette minus itself nudged towards the
                light leaves a crescent on the edges that face it. */}
            <mask id="cgd-lit-tl" maskUnits="userSpaceOnUse" x="0" y="0" width={L.W} height={L.H}>
              <use href="#cgd-sil" fill="#fff" />
              <use href="#cgd-sil" fill="#000" transform="translate(1.3 1.3)" />
            </mask>
            <mask id="cgd-lit-br" maskUnits="userSpaceOnUse" x="0" y="0" width={L.W} height={L.H}>
              <use href="#cgd-sil" fill="#fff" />
              <use href="#cgd-sil" fill="#000" transform="translate(-1.3 -1.3)" />
            </mask>
            {/* The faint spectrum the film's far rim throws. */}
            <linearGradient id="cgd-spectrum" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff9db0" />
              <stop offset="0.35" stopColor="#ffe08a" />
              <stop offset="0.65" stopColor="#8af0d0" />
              <stop offset="1" stopColor="#9fb8ff" />
            </linearGradient>
            {/* The rings' light: the same top-left / bottom-right lighting
                as the glass, fixed about the box's centre. */}
            <linearGradient
              id="cgd-ring-light"
              gradientUnits="userSpaceOnUse"
              x1={sx - 56}
              y1={sy - 56}
              x2={sx + 56}
              y2={sy + 56}
            >
              <stop offset="0" stopColor="rgba(255,255,255,0.95)" />
              <stop offset="0.5" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.7)" />
            </linearGradient>
            {/* Everything but the silhouette: the shadow is cut away under
                the body, or it would show through the glass and dim it. */}
            <mask id="cgd-outside" maskUnits="userSpaceOnUse" x="0" y="0" width={L.W} height={L.H}>
              <rect width={L.W} height={L.H} fill="#fff" />
              <use href="#cgd-sil" fill="#000" />
            </mask>
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
          </g>
        </svg>

        {/* Under the glass: the stamp in its folder, frosted by the sheet
            above it and sharp wherever it rises out of the outline. */}
        <span
          ref={stampRef}
          aria-hidden
          className={`cgd-stamp ${stampHot ? "is-hot" : ""}`}
          style={{ "--stamp-art": `url("${STAMP_ART}")` } as React.CSSProperties}
        >
          <span className="cgd-stamp-lift">
            <span className="cgd-stamp-paper">
              <span className="cgd-stamp-art" />
            </span>
          </span>
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
          <use href="#cgd-sil" className="cgd-shade" clipPath="url(#cgd-clip)" filter="url(#cgd-soft)" />
          <use href="#cgd-sil" className="cgd-glow" clipPath="url(#cgd-clip)" filter="url(#cgd-soft)" />
          <rect width={L.W} height={L.H} fill="url(#cgd-spectrum)" mask="url(#cgd-lit-br)" opacity={0.5} />
          <rect width={L.W} height={L.H} fill="#fff" mask="url(#cgd-lit-br)" opacity={0.5} />
          <rect width={L.W} height={L.H} fill="#fff" mask="url(#cgd-lit-tl)" opacity={0.9} />
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

          {/* Two slots in one body. Left: the red LED matrix, the future
              doorway to the AI bot (destination not built yet — wire its
              onClick when the AI page exists). Right: the stamp folder —
              the occasion stamp lives under the glass (STAMP_ART), the
              cursor's emblem as placeholder, the slot for seasonal logos
              and event artwork later. */}
          <div
            ref={toolsRef}
            className={`cgd-body cgd-tools ${open ? "is-live" : ""}`}
            aria-hidden={!open}
            onPointerEnter={hoverOn("tools")}
            onPointerLeave={hoverOff}
            onPointerDown={pressOn("tools")}
            onPointerUp={pressOff}
          >
            <button
              type="button"
              className="cgd-slot cgd-ai"
              tabIndex={open ? 0 : -1}
              aria-label="Zuhayr AI — coming soon"
              title="Zuhayr AI — coming soon"
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
            <div
              className="cgd-slot cgd-folder"
              aria-hidden
              onPointerEnter={() => setStampHot(true)}
              onPointerLeave={() => setStampHot(false)}
            />
          </div>

          <button
            ref={seedRef}
            type="button"
            className={`cgd-body cgd-seed ${visible ? "is-live" : ""}`}
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? "Close quick actions" : "Open quick actions"}
            tabIndex={visible ? 0 : -1}
            onPointerEnter={hoverOn("seed")}
            onPointerLeave={hoverOff}
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
