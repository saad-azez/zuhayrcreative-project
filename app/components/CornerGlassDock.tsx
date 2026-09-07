"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChromaticMetal from "./ChromaticMetal";
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

/* The artwork on the occasion stamp (see the folder tile below and
   .cgd-folder in the CSS). The cursor's emblem is the placeholder; swap
   this for a seasonal mark or event artwork — anything that reads at
   ~17px on a cream stamp — and the folder does the rest. */
const STAMP_ART = "/AI-9-cursor.png";

/* The AI tile's 5×5 LED matrix, modelled on the reference's Record icon:
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

/**
 * Corner glass dock. What the visitor sees first is not a button but a
 * RIPPLE: faint rings welling up from the bottom-right corner of the
 * screen, occasionally (see the timing constants). Hover the corner and
 * the + box pours in beside them; click it and it rotates into a × and
 * pops THREE liquid-glass boxes out of it: the start-a-project pill and
 * the two tiles. (There was a fourth, an "Email us" pill, until the client
 * pointed out that it and start-a-project are the same errand — the
 * contact page it opens carries the address.) All the appearance rules
 * live in corner-dock.css.
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

  // Pointer tilt — each .cgd-tilt shell pitches toward the cursor, its
  // face shadow slides the opposite way (the light source stays put),
  // and the glare highlight rides the pointer. All via custom properties
  // the CSS reads; hover-capable, motion-tolerant pointers only.
  const dockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(hover: hover)").matches
    ) {
      return;
    }
    const els = Array.from(
      dockRef.current?.querySelectorAll<HTMLElement>(".cgd-tilt") ?? []
    );

    const move = (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5; // −0.5 … 0.5
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--tx", `${(-y * 14).toFixed(2)}deg`);
      el.style.setProperty("--ty", `${(x * 14).toFixed(2)}deg`);
      el.style.setProperty("--shx", `${(-x * 16).toFixed(1)}px`);
      el.style.setProperty("--shy", `${(16 - y * 12).toFixed(1)}px`);
      el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
    };
    const leave = (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      for (const p of ["--tx", "--ty", "--shx", "--shy", "--gx", "--gy"]) {
        el.style.removeProperty(p);
      }
    };

    for (const el of els) {
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
    }
    return () => {
      for (const el of els) {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      }
    };
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

  return (
    <>
      {/* The corner ripple and its hover zone: a quarter-circle at the very
          corner of the screen, rings welling up from the corner point. It
          takes the pointer only while the corner is clear of rivals, so it
          never sits over a "Let's Talk" CTA. Touch has no hover, so a tap
          on the corner does the same as hovering it. */}
      <div
        aria-hidden
        className={`cgd-corner ${rippling ? "is-rippling" : ""} ${clear ? "is-live" : ""}`}
        onPointerEnter={heat}
        onPointerDown={heat}
        onPointerLeave={cool}
      >
        <span className="cgd-wave" />
        <span className="cgd-wave" />
        <span className="cgd-wave" />
      </div>
    <div
      ref={dockRef}
      className={`cgd ${visible ? "is-shown" : ""} ${open ? "is-open" : ""}`}
      onPointerEnter={heat}
      onPointerLeave={cool}
    >
      {/* Pop-out boxes — in the DOM at all times so open/close is a CSS
          morph out of the + box, not a mount pop. Unfocusable while shut,
          and genuinely unpainted (see the visibility rules in the CSS).
          Each is a tilting shell: glass skin on the .cgd-face layer, label
          raised on its own depth plane (see corner-dock.css for why). */}
      <a
        className="cgd-pop cgd-tilt"
        href="/contact"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
      >
        <span aria-hidden className="liquid-glass cgd-face"><ChromaticMetal /></span>
        <span className="cgd-depth">
          Start a project{" "}
          <span aria-hidden className="cgd-arrow">
            &rarr;
          </span>
        </span>
        <span aria-hidden className="cgd-glare" />
      </a>
      {/* Tile row — two small squares between the pills and the +.
          Left: the red LED matrix, the future doorway to the AI bot
          (destination not built yet — wire its href/onClick when the AI
          page exists). Right: the stamp folder — a glass tile with an
          occasion stamp inside it (STAMP_ART); the cursor's emblem is the
          placeholder, the slot for seasonal logos and event artwork later,
          doodle-style. */}
      <div className="cgd-row">
        <button
          type="button"
          className="cgd-pop cgd-tilt cgd-tile"
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          aria-label="Zuhayr AI — coming soon"
          title="Zuhayr AI — coming soon"
        >
          <span aria-hidden className="liquid-glass cgd-face cgd-face-dark"><ChromaticMetal /></span>
          <span aria-hidden className="cgd-depth cgd-led">
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
          <span aria-hidden className="cgd-glare" />
        </button>
        {/* The stamp folder — the logo slot, done as the client's stamp
            reference: a stamp tucked inside the frosted tile, seen blurred
            through the glass, that slides up out of it on hover. The stamp
            comes BEFORE the face in the DOM so it paints beneath it and the
            face's frost is what blurs it. */}
        <div className="cgd-pop cgd-tilt cgd-tile cgd-folder" aria-hidden>
          <span
            aria-hidden
            className="cgd-stamp"
            style={{ "--stamp-art": `url("${STAMP_ART}")` } as React.CSSProperties}
          >
            <span className="cgd-stamp-paper">
              <span className="cgd-stamp-art" />
            </span>
          </span>
          <span aria-hidden className="liquid-glass cgd-face"><ChromaticMetal /></span>
          <span aria-hidden className="cgd-glare" />
        </div>
      </div>

      {/* Float wrapper carries the idle levitation. */}
      <div className="cgd-float">
        <button
          type="button"
          className="cgd-toggle cgd-tilt"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? "Close quick actions" : "Open quick actions"}
        >
          <span aria-hidden className="liquid-glass cgd-face"><ChromaticMetal /></span>
          <span aria-hidden className="cgd-plus cgd-depth">
            +
          </span>
          <span aria-hidden className="cgd-glare" />
        </button>
      </div>
    </div>
    </>
  );
}
