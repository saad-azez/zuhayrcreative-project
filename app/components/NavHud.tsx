"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HUD_ITEMS } from "./navItems";
import "@/app/styles/navbar.css";

/**
 * The HUD: the site's section names in a strip along the top of the screen,
 * the one the reader is in held in the middle and underlined (client, 12 Oct,
 * after the reference they sent: a logo in the corner and the page names
 * across the top, the current one underlined).
 *
 * The strip is a loop, as the fullscreen menu's wheel is: there is no first or
 * last name, the list comes round again on both sides, and it always turns the
 * short way to the name it is after. It turns by itself — scrolling from one
 * section into the next on the home page slides the next name into the middle,
 * and on a page of its own (careers, the club, contact) that page's name is
 * the one in the middle. A name is also a link, the same one the menu has.
 *
 * It can be turned by hand as well, the way the menu's wheel can (client,
 * 14 Oct: "being able to freely scroll on it by clicking on it is missing,
 * similar to the whiplash effect"): take hold of the strip anywhere along it
 * and drag, and it follows the pointer; let go of it moving and it is thrown,
 * carrying on round and settling on a name. Left alone after that, it goes
 * back to the name the reader is in.
 *
 * It stands beside the fullscreen menu rather than in its place: both are on
 * the page, to be looked at together.
 */

const COUNT = HUD_ITEMS.length;
/* A name's share of the strip: a fifth of the screen, so five are across it
   on a desktop, and never tighter than MIN_SLOT, so on a phone the names
   either side of the middle one do not run into it. The loop needs COUNT
   slots to be wider than the screen plus one, or a name would be wanted at
   both ends at once: with seven names or more, it is. */
const SLOTS_ACROSS = 5;
const MIN_SLOT = 104;
/* A name fades out as it nears either end of the strip, gone EDGE_CLEAR from
   the edge: the toggle stands in the left corner, and the close buttons of
   the expanded views in the right. */
const EDGE_CLEAR = 56;
const EDGE_FADE = 70;
/* How quickly the strip closes on the name it is turning to (1/s). */
const EASE = 6;
/* The section under the middle of the screen is looked up at most this often
   while the page scrolls, not on every scroll frame. */
const SCAN_MS = 100;

/* Turning it by hand. */
/* A press becomes a drag once it has moved this far; short of it, it is a
   click on whatever name was under it. */
const DRAG_START_PX = 6;
/* The throw: a strip let go of while moving carries on for what it would
   cover in this long at the speed it had, then settles on the nearest name.
   Never further than one whole turn of the loop. */
const THROW_S = 0.32;
/* Left alone this long after being turned by hand, it goes back to the name
   the reader is in. */
const RETURN_MS = 3500;

/** A distance round the loop, the short way: (-COUNT/2, COUNT/2]. */
const wrap = (d: number) => {
  const m = ((d % COUNT) + COUNT) % COUNT;
  return m > COUNT / 2 ? m - COUNT : m;
};

/** The home page's section for each name that has one. */
const SECTION_IDS = HUD_ITEMS.map((item) => {
  const hash = item.href.indexOf("#");
  return item.href.startsWith("/#") ? item.href.slice(hash + 1) : null;
});

/**
 * Which name the reader is in on the home page: the last section whose top
 * has come up past the middle of the screen, and Home until one has. The
 * stretches between the named sections — the gallery, the impact figures —
 * keep the name of the section before them.
 *
 * Looked up by id each time, not held: the sections below the hero are
 * swapped for their live versions as the reader nears them (LazyHydrate, the
 * globe's shell), and a held element would be the one that was thrown away.
 */
function sectionAtCentre() {
  const line = window.innerHeight / 2;
  let found = 0;
  let foundTop = -Infinity;
  SECTION_IDS.forEach((id, i) => {
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top <= line && top > foundTop) {
      foundTop = top;
      found = i;
    }
  });
  return found;
}

interface Props {
  /** The navbar has made its entrance (the loader's curtain is lifting). */
  entered: boolean;
  reducedMotion: boolean;
  /** The menu's own click handler: scroll to a section on this page, or let
      the link go to another. */
  onNavigate: (e: React.MouseEvent, href: string) => void;
}

export default function NavHud({ entered, reducedMotion, onNavigate }: Props) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  // On the home page the name follows the scroll; anywhere else it is the
  // page's own, or none at all on a page the list does not have.
  const [scrolled, setScrolled] = useState(0);
  const active = onHome
    ? scrolled
    : HUD_ITEMS.findIndex((item) => item.href === pathname);

  const hostRef = useRef<HTMLElement>(null);
  const itemEls = useRef<(HTMLAnchorElement | null)[]>([]);
  // Where the strip is, in names: 2 is the third name in the middle, 2.5 the
  // third and fourth either side of it. Runs on past COUNT; wrap() folds it.
  const start = Math.max(0, active);
  const posRef = useRef(start);
  const targetRef = useRef(start);
  const widthRef = useRef(0);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const reducedRef = useRef(reducedMotion);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);
  // The hand on the strip, if there is one, and the name to go back to.
  const draggingRef = useRef(false);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  // A drag ends in a click on whatever is under the pointer; that one click
  // is not a choice of name.
  const swallowClickRef = useRef(false);

  // The strip's frame loop: runs only while it is turning, and writes the
  // names' places straight to the DOM.
  const loopRef = useRef<{ paint: () => void; wake: () => void } | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const slotWidth = () => Math.max(MIN_SLOT, widthRef.current / SLOTS_ACROSS);

    const paint = () => {
      const width = widthRef.current;
      const slot = slotWidth();
      for (let i = 0; i < COUNT; i++) {
        const el = itemEls.current[i];
        if (!el) continue;
        const x = wrap(i - posRef.current) * slot;
        const fade = Math.min(
          1,
          Math.max(0, (width / 2 - EDGE_CLEAR - Math.abs(x)) / EDGE_FADE),
        );
        el.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
        el.style.opacity = fade.toFixed(3);
        // Hidden, not merely clear: a name off the end of the strip must not
        // take a click or a tab stop.
        el.style.visibility = fade > 0 ? "visible" : "hidden";
      }
    };

    const tick = (now: number) => {
      rafRef.current = 0;
      // In the hand, the strip is where the hand is: nothing to ease.
      if (draggingRef.current) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastRef.current) / 1000));
      lastRef.current = now;
      const gap = targetRef.current - posRef.current;
      if (reducedRef.current || Math.abs(gap) < 0.002) {
        posRef.current = targetRef.current;
        paint();
        return;
      }
      posRef.current += gap * (1 - Math.exp(-dt * EASE));
      paint();
      rafRef.current = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (rafRef.current) return;
      lastRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    };

    loopRef.current = { paint, wake };

    // The strip's width, kept for the loop rather than read in it.
    const ro = new ResizeObserver(() => {
      widthRef.current = host.clientWidth;
      paint();
    });
    ro.observe(host);
    widthRef.current = host.clientWidth;
    paint();

    // ── Turning it by hand ──
    // A press anywhere on the strip (its names, or the band between them).
    // Nothing is captured on the press itself: a press that does not travel
    // is a click on a name and has to reach it. The move and the release are
    // listened for on the window for the length of the press instead.
    let pointerId = -1;
    let downX = 0;
    let downPos = 0;
    let lastX = 0;
    let lastT = 0;
    let speed = 0; // names a second, smoothed over the last few moves
    let returnTimer = 0;

    const goBack = () => {
      returnTimer = 0;
      if (activeRef.current < 0) return;
      targetRef.current =
        posRef.current + wrap(activeRef.current - posRef.current);
      wake();
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - downX;
      if (!draggingRef.current) {
        if (Math.abs(dx) < DRAG_START_PX) return;
        draggingRef.current = true;
        host.dataset.dragging = "true";
      }
      const slot = slotWidth();
      const dt = Math.max(1, e.timeStamp - lastT) / 1000;
      const now = -(e.clientX - lastX) / slot / dt;
      speed += (now - speed) * 0.35;
      lastX = e.clientX;
      lastT = e.timeStamp;
      posRef.current = downPos - dx / slot;
      targetRef.current = posRef.current;
      paint();
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = -1;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!draggingRef.current) return;
      draggingRef.current = false;
      delete host.dataset.dragging;
      // The release of a drag is followed by a click on whatever it was let
      // go over. Only when the pointer is a mouse and still on the strip,
      // though, so the flag is cleared again a moment later either way.
      swallowClickRef.current = true;
      window.setTimeout(() => {
        swallowClickRef.current = false;
      }, 0);
      // A hand that had stopped before letting go throws nothing.
      const stale = e.timeStamp - lastT > 80;
      const thrown = stale || e.type === "pointercancel" ? 0 : speed * THROW_S;
      targetRef.current = Math.round(
        posRef.current + Math.max(-COUNT, Math.min(COUNT, thrown)),
      );
      wake();
      window.clearTimeout(returnTimer);
      returnTimer = window.setTimeout(goBack, RETURN_MS);
    };

    const onDown = (e: PointerEvent) => {
      if (pointerId !== -1) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointerId = e.pointerId;
      downX = lastX = e.clientX;
      lastT = e.timeStamp;
      // From where the strip IS, which mid-turn is not where it is going.
      downPos = posRef.current;
      speed = 0;
      window.clearTimeout(returnTimer);
      returnTimer = 0;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    };
    host.addEventListener("pointerdown", onDown);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      loopRef.current = null;
      window.clearTimeout(returnTimer);
      host.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      draggingRef.current = false;
    };
  }, []);

  // Turn to the current name, the short way round from wherever the strip is.
  useEffect(() => {
    if (active < 0) return;
    targetRef.current = posRef.current + wrap(active - posRef.current);
    loopRef.current?.wake();
  }, [active]);

  // Follow the scroll on the home page.
  useEffect(() => {
    if (!onHome) return;
    let timer = 0;
    const scan = () => {
      timer = 0;
      setScrolled(sectionAtCentre());
    };
    const queue = () => {
      if (!timer) timer = window.setTimeout(scan, SCAN_MS);
    };
    queue(); // a reload or a deep link can start anywhere down the page
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [onHome]);

  return (
    <nav
      ref={hostRef}
      aria-label="Sections"
      className="nav-hud"
      style={{
        opacity: entered ? 1 : 0,
        transition: reducedMotion ? "opacity 0.2s ease" : "opacity 0.7s ease-out",
      }}
      onClickCapture={(e) => {
        if (!swallowClickRef.current) return;
        swallowClickRef.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* What a hand takes hold of between the names: the band itself, short
          of the two corners (the toggle's, and the close buttons'). */}
      <span className="nav-hud__grab" aria-hidden />
      {HUD_ITEMS.map((item, i) => (
        <Link
          key={item.label}
          ref={(el) => {
            itemEls.current[i] = el;
          }}
          href={item.href}
          onClick={(e) => onNavigate(e, item.href)}
          // A link dragged with a mouse is otherwise picked up by the
          // browser as a link to drop somewhere.
          draggable={false}
          className="nav-hud__item"
          data-active={i === active}
          aria-current={
            i === active ? (SECTION_IDS[i] || onHome ? "location" : "page") : undefined
          }
        >
          <span className="nav-hud__label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
