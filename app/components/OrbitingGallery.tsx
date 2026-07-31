"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import { useSplashHover } from "./useSplashHover";
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
 * One wheel item. Split out purely so the cursor-splash hook has a component to
 * live in — hooks can't be called inside the PROJECTS map. The parent still gets
 * the DOM node through `registerRef`, because the animation loop positions every
 * item by writing transforms to it each frame.
 *
 * `crossOrigin` is required for the splash: the shader has to upload the image
 * into a WebGL texture, and a cross-origin image without it taints the texture.
 * (These are picsum placeholders; picsum serves CORS headers. The hook falls
 * back to the plain image if any source ever doesn't.)
 */
function OrbitItem({
  project,
  eager,
  registerRef,
  onSelect,
}: {
  project: Project;
  index: number;
  eager: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  onSelect: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useSplashHover(ref);

  return (
    <div
      ref={(el) => {
        ref.current = el;
        registerRef(el);
      }}
      className="orbit__item"
      onClick={onSelect}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={project.src}
        alt={project.name}
        className="orbit__img"
        draggable={false}
        crossOrigin="anonymous"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    </div>
  );
}

/**
 * Orbiting gallery — images ride a large circle, rotating clockwise. A focus
 * zone at the 3-o'clock point scales the nearest images up. The wheel keeps
 * turning on its own but can also be grabbed and spun with the cursor, and any
 * image can be clicked to enlarge it. It swings in from the left (3D boomerang)
 * the first time the section scrolls into view.
 */
export default function OrbitingGallery() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const draggedRef = useRef(false); // set during a drag so it doesn't fire a click
  const originRectRef = useRef<DOMRect | null>(null); // clicked image's on-screen box
  const lightboxImgRef = useRef<HTMLImageElement>(null);
  // Host for the enlarged image's cursor splash. The lightbox is portaled and
  // only mounts while something is selected, so the hook is keyed on `selected`
  // — without a changing dependency the effect would never see the new node.
  const lightboxRef = useRef<HTMLDivElement>(null);
  const { prefersReducedMotion } = useDeviceDetect();

  const [focusIndex, setFocusIndex] = useState(0);
  const focusRef = useRef(0);
  const [entered, setEntered] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const focused = PROJECTS[focusIndex];

  // Cursor splash on the enlarged image too — the lightbox renders its own
  // <img>, so the wheel items' hooks don't reach it.
  useSplashHover(lightboxRef, selected !== null);

  // Boomerang entrance — trigger once when the section scrolls into view.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setEntered(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Close the enlarged view on Escape.
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // Lock page scroll while the enlarged view is open — same as the navbar menu:
  // freeze native scroll AND stop the Locomotive/Lenis smooth scroll, so the
  // frosted backdrop sits over a static page.
  useEffect(() => {
    if (selected === null) return;
    document.body.style.overflow = "hidden";
    window.dispatchEvent(new Event("app:scroll-lock"));
    return () => {
      document.body.style.overflow = "";
      window.dispatchEvent(new Event("app:scroll-unlock"));
    };
  }, [selected]);


  // FLIP: scale the (already-loaded) clicked image up from where it sat in the
  // wheel to its centred enlarged position — no new image is fetched.
  useEffect(() => {
    if (selected === null) return;
    const img = lightboxImgRef.current;
    const origin = originRectRef.current;
    if (!img) return;
    if (prefersReducedMotion || !origin) {
      img.style.opacity = "1";
      return;
    }
    const final = img.getBoundingClientRect();
    const sx = origin.width / final.width;
    const sy = origin.height / final.height;
    const dx = origin.left + origin.width / 2 - (final.left + final.width / 2);
    const dy = origin.top + origin.height / 2 - (final.top + final.height / 2);
    img.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 1 },
        { transform: "translate(0, 0) scale(1, 1)", opacity: 1 },
      ],
      { duration: 420, easing: "cubic-bezier(0.22, 0.9, 0.3, 1.04)", fill: "both" },
    );
  }, [selected, prefersReducedMotion]);

  useEffect(() => {
    const stage = stageRef.current;
    const items = itemRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!stage || !items.length) return;
    const N = items.length;

    // ── Tunables ──
    const SIGMA = 0.55;
    const MIN_SCALE = 0.32;
    const MAX_SCALE = 2.0;
    const SPREAD = 0.95;
    const SPREAD_SIGMA = 0.62;
    const SPEED = 0.3; // rad/sec — clockwise auto-rotation
    const TWO_PI = Math.PI * 2;
    const SLOT = TWO_PI / N;

    let w = stage.clientWidth;
    let h = stage.clientHeight;
    const zCache = new Array(N).fill(-1);

    const draw = (offset: number) => {
      const cx = w * 0.36;
      const cy = h * 0.5;
      const R = Math.min(h * 0.4, w * 0.28);
      for (let i = 0; i < N; i++) {
        const el = items[i];
        const base = (i / N) * TWO_PI;
        // Clockwise: angle increases over time, so on the right side items
        // descend through the focus.
        let d = (((base + offset) % TWO_PI) + TWO_PI) % TWO_PI;
        if (d > Math.PI) d -= TWO_PI;
        // Anti-overlap spread: enlarged items near the focus push neighbours
        // apart; distant items stay packed.
        const spread =
          SPREAD * Math.exp(-(d * d) / (2 * SPREAD_SIGMA * SPREAD_SIGMA));
        const theta = d * (1 + spread);
        const x = cx + R * Math.cos(theta);
        const y = cy + R * Math.sin(theta);
        const env = Math.exp(-(d * d) / (2 * SIGMA * SIGMA)); // 1 at focus → 0 away
        const scale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * env;
        el.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%)) scale(${scale})`;
        const z = Math.round(env * 60);
        if (zCache[i] !== z) {
          el.style.zIndex = String(z);
          zCache[i] = z;
        }
      }
    };
    const reveal = () => items.forEach((el) => (el.style.opacity = "1"));

    const onResize = () => {
      w = stage.clientWidth;
      h = stage.clientHeight;
      if (prefersReducedMotion) draw(0);
    };
    window.addEventListener("resize", onResize);

    if (prefersReducedMotion) {
      draw(0);
      reveal();
      return () => window.removeEventListener("resize", onResize);
    }

    draw(0);
    reveal();

    let raf = 0;
    let visible = true;
    let offset = 0;
    let vel = 0; // momentum (rad/sec) imparted by a flick
    let last = performance.now();

    // ── Grab-and-spin (cursor) — runs on top of the auto-rotation ──
    let dragging = false;
    let cxView = 0;
    let cyView = 0;
    let lastA = 0;
    let lastT = 0;
    let totalDelta = 0;
    const angleAt = (px: number, py: number) =>
      Math.atan2(py - cyView, px - cxView);
    const onDown = (e: PointerEvent) => {
      dragging = true;
      draggedRef.current = false;
      totalDelta = 0;
      const r = stage.getBoundingClientRect();
      cxView = r.left + w * 0.36;
      cyView = r.top + h * 0.5;
      lastA = angleAt(e.clientX, e.clientY);
      lastT = performance.now();
      vel = 0;
      stage.classList.add("is-grabbing");
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const a = angleAt(e.clientX, e.clientY);
      let inc = a - lastA;
      if (inc > Math.PI) inc -= TWO_PI;
      if (inc < -Math.PI) inc += TWO_PI;
      offset += inc;
      totalDelta += inc;
      const now = performance.now();
      const dtm = (now - lastT) / 1000;
      if (dtm > 0) vel = inc / dtm;
      lastA = a;
      lastT = now;
      if (Math.abs(totalDelta) > 0.025) draggedRef.current = true; // it's a drag
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove("is-grabbing");
      vel = Math.max(-8, Math.min(8, vel)); // clamp flick momentum
    };
    // A touch gesture does NOT always end in `pointerup`: as soon as the browser
    // decides the drag belongs to it (a page scroll), it claims the pointer and
    // fires `pointercancel` instead. Without this the drag never ended, so
    // `dragging` stayed true, the `if (!dragging)` guard below froze the
    // auto-rotation, and the wheel sat locked until the next touch — the
    // tablet/phone-only lock-up. Mouse input always delivers `pointerup`, which
    // is why desktop never showed it.
    const onCancel = () => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove("is-grabbing");
      vel = 0; // the gesture was taken over — don't fling on the way out
    };
    stage.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);

    const loop = (now: number) => {
      if (!visible) {
        raf = 0;
        return;
      }
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      if (!dragging) {
        offset += (SPEED + vel) * dt;
        vel *= Math.pow(0.9, dt * 60); // decay flick momentum
        if (Math.abs(vel) < 0.001) vel = 0;
      }
      draw(offset);
      // Item at the focus (clockwise: focus base angle = -offset).
      const fi = ((-Math.round(offset / SLOT) % N) + N) % N;
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
          last = performance.now();
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0 },
    );
    // Observe the section (untransformed) — the stage starts shifted off-screen
    // for the entrance, which would otherwise read as "not visible".
    io.observe(sectionRef.current ?? stage);

    raf = requestAnimationFrame(loop);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
      stage.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [prefersReducedMotion]);

  return (
    <section ref={sectionRef} id="work" className="orbit" aria-label="Selected work">
      <div ref={stageRef} className={`orbit__stage${entered ? " is-in" : ""}`}>
        {PROJECTS.map((p, i) => (
          <OrbitItem
            key={i}
            project={p}
            index={i}
            eager={i < 3}
            registerRef={(el) => {
              itemRefs.current[i] = el;
            }}
            onSelect={(e) => {
              if (draggedRef.current) return; // ignore the click that ends a drag
              originRectRef.current = e.currentTarget.getBoundingClientRect();
              // Water splash bursting from the click as the image flies out.
              window.dispatchEvent(
                new CustomEvent("app:splash", {
                  detail: { x: e.clientX, y: e.clientY },
                }),
              );
              setSelected(i);
            }}
          />
        ))}
      </div>

      {/* Caption for the focused (right) project — name, service, year. */}
      <div className="orbit__caption" aria-live="polite">
        <div className="orbit__caption-inner" key={focusIndex}>
          <span className="orbit__caption-year">{focused.year}</span>
          <h3 className="orbit__caption-name">{focused.name}</h3>
          <span className="orbit__caption-service">{focused.service}</span>
        </div>
      </div>

      {/* Click-to-enlarge view — portaled to <body> so it escapes the section's
          `perspective` containing block and covers the true viewport. */}
      {selected !== null &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          ref={lightboxRef}
          className="orbit__lightbox bg-black/30 backdrop-blur-2xl"
          data-lenis-prevent
          role="dialog"
          aria-modal="true"
          aria-label={PROJECTS[selected].name}
          onClick={() => setSelected(null)}
        >
          <button
            type="button"
            className="orbit__lightbox-close"
            aria-label="Close"
            onClick={() => setSelected(null)}
          >
            ✕
          </button>
          {/* Same (already-loaded) image — reused, not re-fetched. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={lightboxImgRef}
            src={PROJECTS[selected].src}
            alt={PROJECTS[selected].name}
            className="orbit__lightbox-img"
            crossOrigin="anonymous"
          />
          <div className="orbit__lightbox-cap">
            <span className="orbit__caption-year">{PROJECTS[selected].year}</span>
            <h3 className="orbit__lightbox-name">{PROJECTS[selected].name}</h3>
            <span className="orbit__caption-service">
              {PROJECTS[selected].service}
            </span>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
