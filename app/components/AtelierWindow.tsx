"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "@/app/styles/atelier.css";

/**
 * The atelier (model draft, /?hero=model): the latest Paint to Pixel window
 * (atelier/, built into public/atelier/atelier-window.js), shown over the
 * site. Three ways in, all through `app:atelier-open` ({ from }):
 *
 *   idle   the idle screen's home for it (IdleScreen, in the model draft):
 *          full screen, closed with Resume;
 *   menu   the quiet "Atelier" link in the menu: full screen, on demand;
 *   exit   desktop only, the pointer heading up for the tabs or the address
 *          bar: the site dims and the window lights up, framed, as a shop
 *          window does when you walk past it on your way out. Step inside
 *          takes it full screen. Once per tab, and only once the visitor
 *          has been to the end of the site: on the way out, never mid-read.
 *
 * The module is fetched when first asked for (or on `app:atelier-prewarm`,
 * which the idle screen sends 8 s ahead), mounted while the window is open
 * and taken down when it closes, so it costs nothing the rest of the time.
 */

type From = "idle" | "menu" | "exit";
type AtelierModule = {
  mountAtelier(el: HTMLElement, props?: { assetBase?: string }): { destroy(): void };
};

const BASE = "/atelier/";
const EXIT_KEY = "zc-atelier-exit";
const EXIT_AFTER_MS = 12_000;
const CLOSE_MS = 450;
/**
 * How long the window warms up unseen before it is shown: long enough for its
 * textures to decode and its shaders to compile, so it opens already live
 * instead of holding on its poster (client, 24 Oct: "a static hold of the
 * atelier before it started animating"). Then it sleeps until opened.
 */
const WARM_MS = 14_000;

let modulePromise: Promise<AtelierModule> | null = null;
function loadAtelier(): Promise<AtelierModule> {
  modulePromise ??= import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ `${BASE}atelier-window.js`
  ) as Promise<AtelierModule>;
  return modulePromise;
}

export default function AtelierWindow() {
  // What opened it (null: closed), whether it is full screen, and whether it
  // is on its way out.
  const [from, setFrom] = useState<From | null>(null);
  const [full, setFull] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Once opened it stays mounted, asleep (display: none stops its frame
  // loop), so opening it again is instant rather than a second start-up.
  const [ever, setEver] = useState(false);
  // Warming: mounted and drawing, but invisible, ahead of being opened.
  const [warm, setWarm] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);

  const open = useCallback((how: From) => {
    if (openRef.current) return;
    openRef.current = true;
    setLeaving(false);
    setFull(how !== "exit");
    setFrom(how);
    setEver(true);
  }, []);

  const close = useCallback(() => {
    if (!openRef.current) return;
    setLeaving(true);
    window.setTimeout(() => {
      openRef.current = false;
      setFrom(null);
      setLeaving(false);
      window.dispatchEvent(new Event("app:atelier-closed"));
    }, CLOSE_MS);
  }, []);

  // Asked for from anywhere on the page.
  useEffect(() => {
    const onOpen = (e: Event) => open(((e as CustomEvent).detail?.from as From) ?? "menu");
    // Warm it up unseen: 8 s before the idle screen (IdleScreen sends this),
    // and the moment the menu opens, where its link is.
    const onPrewarm = () => {
      void loadAtelier().catch(() => {});
      if (openRef.current) return;
      setEver(true);
      setWarm(true);
    };
    window.addEventListener("app:atelier-open", onOpen);
    window.addEventListener("app:atelier-prewarm", onPrewarm);
    // The menu opening (the Navbar sets body.menu-open).
    let menuWas = document.body.classList.contains("menu-open");
    const mo = new MutationObserver(() => {
      const now = document.body.classList.contains("menu-open");
      if (now && !menuWas) onPrewarm();
      menuWas = now;
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.removeEventListener("app:atelier-open", onOpen);
      window.removeEventListener("app:atelier-prewarm", onPrewarm);
      mo.disconnect();
    };
  }, [open]);

  // The warm-up ends after WARM_MS (opened meanwhile, it simply shows); then
  // it sleeps, ready, until it is opened.
  useEffect(() => {
    if (!warm) return;
    const id = window.setTimeout(() => setWarm(false), WARM_MS);
    return () => window.clearTimeout(id);
  }, [warm]);

  // Exit intent (desktop): the pointer leaving through the top of the page,
  // or arriving at its very top edge on the way up.
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let since = 0;
    const onUncovered = () => (since = performance.now());
    if ((window as Window & { __appUncovered?: boolean }).__appUncovered) since = performance.now();
    window.addEventListener("app:uncovered", onUncovered);
    let lastY = -1;
    // Armed only once the visitor has reached the end of the page.
    let finished = false;
    const onScroll = () => {
      const el = document.documentElement;
      if (window.scrollY + window.innerHeight >= el.scrollHeight - window.innerHeight * 0.5) finished = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const seen = () => {
      try {
        return sessionStorage.getItem(EXIT_KEY) === "1";
      } catch {
        return false;
      }
    };
    const fire = () => {
      if (!finished || !since || performance.now() - since < EXIT_AFTER_MS) return;
      if (openRef.current || seen() || document.hidden) return;
      const b = document.body.classList;
      if (b.contains("menu-open") || b.contains("is-idle")) return;
      try {
        sessionStorage.setItem(EXIT_KEY, "1");
      } catch {}
      open("exit");
    };
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 4) fire();
    };
    const onMove = (e: MouseEvent) => {
      if (lastY >= 0 && e.clientY <= 3 && e.clientY < lastY) fire();
      lastY = e.clientY;
    };
    document.addEventListener("mouseout", onOut);
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("app:uncovered", onUncovered);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("mousemove", onMove);
    };
  }, [open]);

  // While open: the page holds still and its own loops rest under it.
  useEffect(() => {
    if (!from) return;
    const b = document.body;
    b.classList.add("atelier-open", "scene-cover");
    window.dispatchEvent(new Event("app:scene-cover"));
    window.dispatchEvent(new Event("app:scroll-lock"));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      b.classList.remove("atelier-open");
      // The services section keeps the flag while one of its scenes is up.
      if (document.querySelector<HTMLElement>(".svv3__pin")?.dataset.cover !== "1") {
        b.classList.remove("scene-cover");
        window.dispatchEvent(new Event("app:scene-uncover"));
      }
      window.dispatchEvent(new Event("app:scroll-unlock"));
    };
  }, [from, close]);

  // The window itself, mounted the first time it is opened.
  useEffect(() => {
    const el = hostRef.current;
    if (!ever || !el) return;
    let handle: { destroy(): void } | null = null;
    let gone = false;
    loadAtelier()
      .then((m) => {
        if (!gone) handle = m.mountAtelier(el, { assetBase: BASE });
      })
      .catch(() => {});
    return () => {
      gone = true;
      handle?.destroy();
    };
  }, [ever]);

  if (!ever) return null;
  return (
    <div
      className="atl"
      hidden={!from && !warm}
      data-warming={!from && warm ? "" : undefined}
      data-from={from ?? undefined}
      data-full={full ? "" : undefined}
      data-leaving={leaving ? "" : undefined}
      role="dialog"
      aria-modal={from ? "true" : undefined}
      aria-label="The atelier"
    >
      <div className="atl__veil" onClick={full ? undefined : close} />
      <div className="atl__frame">
        <picture className="atl__poster">
          <source media="(orientation: portrait)" type="image/avif" srcSet={`${BASE}poster-portrait.avif`} />
          <source media="(orientation: portrait)" srcSet={`${BASE}poster-portrait.jpg`} />
          <source type="image/avif" srcSet={`${BASE}poster.avif`} />
          <img src={`${BASE}poster.jpg`} alt="" draggable={false} />
        </picture>
        <div ref={hostRef} className="atl__host" />
      </div>
      {!full && (
        <div className="atl__invite">
          <p className="atl__kicker">
            <span>(</span>Atelier<span>)</span>
          </p>
          <p className="atl__line">Before you go, the window.</p>
          <div className="atl__actions">
            <button type="button" className="atl__btn atl__btn--in" onClick={() => setFull(true)}>
              Step inside
            </button>
            <button type="button" className="atl__btn" onClick={close}>
              Not now
            </button>
          </div>
        </div>
      )}
      {full && (
        <button type="button" className="atl__close" onClick={close} aria-label={from === "idle" ? "Resume browsing" : "Close the atelier"}>
          {from === "idle" ? "Resume" : "Close"}
          <span aria-hidden>×</span>
        </button>
      )}
    </div>
  );
}
