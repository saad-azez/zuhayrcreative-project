"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./navItems";
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
 * It stands beside the fullscreen menu rather than in its place: both are on
 * the page, to be looked at together.
 */

const COUNT = NAV_ITEMS.length;
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

/** A distance round the loop, the short way: (-COUNT/2, COUNT/2]. */
const wrap = (d: number) => {
  const m = ((d % COUNT) + COUNT) % COUNT;
  return m > COUNT / 2 ? m - COUNT : m;
};

/** The home page's section for each name that has one. */
const SECTION_IDS = NAV_ITEMS.map((item) => {
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
    : NAV_ITEMS.findIndex((item) => item.href === pathname);

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

  // The strip's frame loop: runs only while it is turning, and writes the
  // names' places straight to the DOM.
  const loopRef = useRef<{ paint: () => void; wake: () => void } | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const paint = () => {
      const width = widthRef.current;
      const slot = Math.max(MIN_SLOT, width / SLOTS_ACROSS);
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

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      loopRef.current = null;
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
    >
      {NAV_ITEMS.map((item, i) => (
        <Link
          key={item.label}
          ref={(el) => {
            itemEls.current[i] = el;
          }}
          href={item.href}
          onClick={(e) => onNavigate(e, item.href)}
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
