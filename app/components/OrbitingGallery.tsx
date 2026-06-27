"use client";

import { useEffect, useRef, useState } from "react";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import "@/app/styles/orbiting-gallery.css";

/**
 * ⚠️ PLACEHOLDER projects — swap `src`, `name`, `service`, `year` for the real
 * work. Picsum seeds give stable, varied placeholder images that always load.
 */
interface Project {
  src: string;
  name: string;
  service: string;
  year: string;
}

const PROJECTS: Project[] = [
  { src: "https://picsum.photos/seed/zc-orbit-01/320/320", name: "Forma Digital", service: "Brand Identity", year: "2026" },
  { src: "https://picsum.photos/seed/zc-orbit-02/320/320", name: "Nero Vision", service: "Motion Design", year: "2025" },
  { src: "https://picsum.photos/seed/zc-orbit-03/320/320", name: "Lumina Arc", service: "Web Experience", year: "2025" },
  { src: "https://picsum.photos/seed/zc-orbit-04/320/320", name: "Atlas Foundry", service: "Brand Systems", year: "2024" },
  { src: "https://picsum.photos/seed/zc-orbit-05/320/320", name: "Halo Studio", service: "Creative Direction", year: "2024" },
  { src: "https://picsum.photos/seed/zc-orbit-06/320/320", name: "Drift Labs", service: "AI Automation", year: "2026" },
  { src: "https://picsum.photos/seed/zc-orbit-07/320/320", name: "Solace", service: "Web Design", year: "2025" },
  { src: "https://picsum.photos/seed/zc-orbit-08/320/320", name: "Vanta Goods", service: "Brand Identity", year: "2023" },
  { src: "https://picsum.photos/seed/zc-orbit-09/320/320", name: "Pulse Health", service: "Product Design", year: "2024" },
  { src: "https://picsum.photos/seed/zc-orbit-10/320/320", name: "Orbit Media", service: "Search Growth", year: "2025" },
  { src: "https://picsum.photos/seed/zc-orbit-11/320/320", name: "Kestrel", service: "Art Direction", year: "2023" },
  { src: "https://picsum.photos/seed/zc-orbit-12/320/320", name: "Mono Atelier", service: "Web Design", year: "2026" },
  { src: "https://picsum.photos/seed/zc-orbit-13/320/320", name: "Spectra", service: "Motion Design", year: "2024" },
  { src: "https://picsum.photos/seed/zc-orbit-14/320/320", name: "Northbound", service: "Brand Systems", year: "2025" },
];

/**
 * Orbiting gallery — images sit on a large circle and orbit anticlockwise in a
 * continuous loop. A focus zone at the 3-o'clock point (right-centre) scales the
 * nearest images up to a peak, tapering smaller above/below and smallest on the
 * far side, so each image swells as it rises into the focus and shrinks past it.
 */
export default function OrbitingGallery() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { prefersReducedMotion } = useDeviceDetect();

  // Live controls: 0 = Push (eased dwell), 1 = Linear (constant). And 0 = Small
  // … 1 = Large for the focused image size. Mirrored into refs so the rAF loop
  // reads them every frame without restarting.
  const [linearity, setLinearity] = useState(0.3);
  const [sizeAmt, setSizeAmt] = useState(0.55);
  const linearityRef = useRef(linearity);
  const sizeRef = useRef(sizeAmt);
  useEffect(() => {
    linearityRef.current = linearity;
  }, [linearity]);
  useEffect(() => {
    sizeRef.current = sizeAmt;
  }, [sizeAmt]);

  // Which project is currently at the focus (right-centre). The loop updates it
  // only when it changes, so the caption re-renders ~once per slot, not per frame.
  const [focusIndex, setFocusIndex] = useState(0);
  const focusRef = useRef(0);
  const focused = PROJECTS[focusIndex];

  useEffect(() => {
    const stage = stageRef.current;
    const items = itemRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!stage || !items.length) return;
    const N = items.length;

    // ── Tunables ──
    const SIGMA = 0.55; // focus width (smaller = tighter focus zone)
    const MIN_SCALE = 0.3;
    const SPREAD_SIGMA = 0.62; // width of the anti-overlap push zone
    const BEAT = 1.25; // seconds per slot (the "push" rhythm)
    const TWO_PI = Math.PI * 2;
    const SLOT = TWO_PI / N;

    let w = stage.clientWidth;
    let h = stage.clientHeight;

    // The Small↔Large slider drives max size; the spread grows with it so the
    // bigger the images get, the harder neighbours are pushed apart.
    const sizeToMax = (s: number) => 1.3 + s * 1.55; // 1.3 … 2.85
    const sizeToSpread = (s: number) => 0.55 + s * 1.0; // grows with size

    // z-index is only written when its (rounded) value changes, so we're not
    // restacking 14 elements every frame — that churn is what fights the scroll.
    const zCache = new Array(N).fill(-1);

    const draw = (offset: number, maxScale: number, spreadAmt: number) => {
      // Circle shifted left so the focused (right) image has room for its
      // caption on the right.
      const cx = w * 0.36;
      const cy = h * 0.5;
      const R = Math.min(h * 0.4, w * 0.28);
      for (let i = 0; i < N; i++) {
        const el = items[i];
        const base = (i / N) * TWO_PI;
        // Nominal angular distance to the focus (3 o'clock = 0), in [-π, π].
        // Anticlockwise: decreasing angle → items on the right side rise up.
        let d = (((base - offset) % TWO_PI) + TWO_PI) % TWO_PI;
        if (d > Math.PI) d -= TWO_PI;
        // Anti-overlap spread: bigger items near the focus subtend more angle,
        // so push them away from the focus centre (and each other). Items far
        // from the focus get spread ≈ 0 and stay packed together.
        const spread =
          spreadAmt * Math.exp(-(d * d) / (2 * SPREAD_SIGMA * SPREAD_SIGMA));
        const theta = d * (1 + spread);
        const x = cx + R * Math.cos(theta);
        const y = cy + R * Math.sin(theta);
        const env = Math.exp(-(d * d) / (2 * SIGMA * SIGMA)); // 1 at focus → 0 away
        const scale = MIN_SCALE + (maxScale - MIN_SCALE) * env;
        el.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%)) scale(${scale})`;
        const z = Math.round(env * 60);
        if (zCache[i] !== z) {
          el.style.zIndex = String(z);
          zCache[i] = z;
        }
      }
    };

    // Position once, then reveal — avoids a first-frame flash and lets us drop
    // the per-frame opacity write.
    const reveal = () => items.forEach((el) => (el.style.opacity = "1"));

    const onResize = () => {
      w = stage.clientWidth;
      h = stage.clientHeight;
      if (prefersReducedMotion)
        draw(0, sizeToMax(sizeRef.current), sizeToSpread(sizeRef.current));
    };
    window.addEventListener("resize", onResize);

    if (prefersReducedMotion) {
      draw(0, sizeToMax(sizeRef.current), sizeToSpread(sizeRef.current));
      reveal();
      return () => window.removeEventListener("resize", onResize);
    }

    // ease-in-out: items dwell at each slot (slow), then push to the next.
    const easeInOut = (f: number) =>
      f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;

    draw(0, sizeToMax(sizeRef.current), sizeToSpread(sizeRef.current));
    reveal();

    let raf = 0;
    let visible = true;
    let clock = 0; // own clock, advanced by a clamped dt
    let last = performance.now();

    const loop = (now: number) => {
      if (!visible) {
        raf = 0;
        return;
      }
      // Clamp the timestep: if a frame is dropped during aggressive scrolling,
      // the orbit advances by at most one capped step and resumes smoothly
      // instead of jumping forward to "catch up" (the jerk).
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      clock += dt;
      const lin = linearityRef.current; // 1 = linear, 0 = push
      const size = sizeRef.current;
      const beatT = clock / BEAT;
      const bi = Math.floor(beatT);
      const f = beatT - bi;
      const prog = easeInOut(f) * (1 - lin) + f * lin;
      const offset = (bi + prog) * SLOT;
      draw(offset, sizeToMax(size), sizeToSpread(size));
      const fi = ((Math.round(offset / SLOT) % N) + N) % N;
      if (fi !== focusRef.current) {
        focusRef.current = fi;
        setFocusIndex(fi);
      }
      raf = requestAnimationFrame(loop);
    };

    // Pause the loop entirely while the section is off-screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf) {
          last = performance.now(); // reset so dt doesn't spike on resume
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0 },
    );
    io.observe(stage);

    raf = requestAnimationFrame(loop);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [prefersReducedMotion]);

  return (
    <section ref={sectionRef} id="work" className="orbit" aria-label="Selected work">
      <div ref={stageRef} className="orbit__stage">
        {PROJECTS.map((p, i) => (
          <div
            key={i}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="orbit__item"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.src} alt={p.name} className="orbit__img" />
          </div>
        ))}
      </div>

      {/* Caption for the focused (right) project — name, service, year. The
          key remounts it on change so it crossfades in as each image arrives. */}
      <div className="orbit__caption" aria-live="polite">
        <div className="orbit__caption-inner" key={focusIndex}>
          <span className="orbit__caption-year">{focused.year}</span>
          <h3 className="orbit__caption-name">{focused.name}</h3>
          <span className="orbit__caption-service">{focused.service}</span>
        </div>
      </div>

      {/* Live controls — orbit easing + focused image size */}
      <div className="orbit__controls" data-lenis-prevent>
        <div className="orbit__ctrl">
          <span className="orbit__ctrl-label">Push</span>
          <input
            className="orbit__range"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={linearity}
            onChange={(e) => setLinearity(parseFloat(e.target.value))}
            aria-label="Orbit motion: push to linear"
          />
          <span className="orbit__ctrl-label orbit__ctrl-label--right">
            Linear
          </span>
        </div>
        <div className="orbit__ctrl">
          <span className="orbit__ctrl-label">Small</span>
          <input
            className="orbit__range"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={sizeAmt}
            onChange={(e) => setSizeAmt(parseFloat(e.target.value))}
            aria-label="Focused image size: small to large"
          />
          <span className="orbit__ctrl-label orbit__ctrl-label--right">
            Large
          </span>
        </div>
      </div>
    </section>
  );
}
