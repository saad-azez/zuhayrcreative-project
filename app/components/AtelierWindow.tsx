"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isPhoneDevice } from "@/app/lib/device";
import { releaseDetachedContexts } from "@/app/lib/webglContexts";
import "@/app/styles/atelier.css";

/**
 * The atelier (model draft, /?hero=model): the latest Paint to Pixel window
 * (atelier/, built into public/atelier/atelier-window.js), shown over the
 * site. Three ways in, all through `app:atelier-open` ({ from }):
 *
 *   idle   the idle screen's home for it (IdleScreen, in the model draft):
 *          full screen, closed with Resume, or on its own after a minute
 *          or so left alone, back to the hero (IDLE_RETURN_MS);
 *   menu   the quiet "Atelier" link in the menu: full screen, on demand;
 *   exit   desktop only, the pointer heading up for the tabs or the address
 *          bar: the site dims and the window lights up, framed, as a shop
 *          window does when you walk past it on your way out. Step inside
 *          takes it full screen. Once per tab, and only once the visitor
 *          has been to the end of the site: on the way out, never mid-read.
 *
 * It is loaded on the way in: a few seconds after the curtain lifts, it warms
 * up once unseen (its code and files, decoding, compiling, its first frames)
 * and sleeps, so whatever brings it up later opens it already live. `app:atelier-prewarm`
 * (the idle screen 8 s ahead, the menu opening) still warms it if that has
 * not happened yet.
 */

type From = "idle" | "menu" | "exit";
type AtelierModule = {
  mountAtelier(el: HTMLElement, props?: { assetBase?: string; onLive?: () => void }): { destroy(): void };
};

const BASE = "/atelier/";
const EXIT_KEY = "zc-atelier-exit";
const EXIT_AFTER_MS = 12_000;
const CLOSE_MS = 300;
const REBUILD_AFTER_MS = 50;
/**
 * How long the window warms up unseen before it is shown: long enough for its
 * textures to decode and its shaders to compile, so it opens already live
 * instead of holding on its poster (client, 24 Oct: "a static hold of the
 * atelier before it started animating"). Then it sleeps until opened.
 */
const WARM_MS = 14_000;
/**
 * Once the site's curtain is up and the page has had this long to settle, the window warms up once, unseen: its code and files
 * come down, are decoded and compiled (nothing is drawn meanwhile), it draws its first frames and goes to sleep. By the time
 * the idle screen, the menu or the exit brings it up (seconds or minutes later), it opens already live.
 */
const PRELOAD_AFTER_MS = 3_000;
/** After its first frames are drawn, the warm-up lets it run this much longer (its caches settle), then puts it to sleep. */
const WARM_AFTER_LIVE_MS = 800;
/**
 * Opened by the idle screen, the window goes back to the hero on its own once
 * nobody has touched the page for this long: four of its 16.4 s loops, time
 * to watch it come round a few times. Any input while it is up starts the
 * count again.
 */
const IDLE_RETURN_MS = 4 * 16_400;

/**
 * The window runs in a frame of its own, made on opening and removed on
 * closing, so everything it makes goes with it: its copy of the module, the
 * code compiled for it, three's caches, its WebGL contexts (really destroyed,
 * not the simulated loss Safari gives `loseContext()`).
 *
 * In the page itself none of that could be handed back. A module once
 * imported is kept for the life of the page: measured on the client's iPhone
 * 12 (23 Nov), one opening left ~190 MB behind even after its destroy() had
 * deleted every GPU object, and the scroll after Close then crossed iOS's
 * 1536 MB limit. A frame's realm is freed whole.
 *
 * Warming up (prewarm) only fetches the file into the HTTP cache: imported
 * into the page it would stay there for good.
 */
const MODULE_URL = `${BASE}atelier-window.js`;
let warmed: Promise<unknown> | null = null;
function loadSource(): Promise<unknown> {
  warmed ??= fetch(MODULE_URL).then((r) => {
    if (!r.ok) throw new Error(`atelier ${r.status}`);
    return r.blob();
  });
  warmed.catch(() => (warmed = null));
  return warmed;
}
const FRAME_DOC =
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">' +
  "<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;-webkit-tap-highlight-color:transparent;touch-action:none}</style>" +
  "</head><body></body></html>";
/** Input the page listens for while the window is up (its idle return), passed out of the frame. */
const FORWARDED = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;
/** Makes the frame in `el` and loads a fresh copy of the module into it. */
function loadAtelier(el: HTMLElement): Promise<{ mod: AtelierModule; frame: HTMLIFrameElement; root: HTMLElement }> {
  const frame = document.createElement("iframe");
  frame.className = "atl__doc";
  frame.setAttribute("title", "The atelier");
  frame.setAttribute("allow", "fullscreen");
  el.appendChild(frame);
  const win = frame.contentWindow as (Window & typeof globalThis & { __atl?: (m: AtelierModule) => void; __atlFail?: () => void }) | null;
  const doc = frame.contentDocument;
  if (!win || !doc) {
    frame.remove();
    return Promise.reject(new Error("atelier frame"));
  }
  doc.open();
  doc.write(FRAME_DOC);
  doc.close();
  for (const type of FORWARDED) {
    win.addEventListener(type, () => window.dispatchEvent(new Event(type)), { passive: true });
  }
  return new Promise((resolve, reject) => {
    win.__atl = (mod) => resolve({ mod, frame, root: doc.body });
    win.__atlFail = () => {
      frame.remove();
      reject(new Error("atelier import"));
    };
    const script = doc.createElement("script");
    script.type = "module";
    script.textContent = `import(${JSON.stringify(new URL(MODULE_URL, location.href).href)}).then((m) => window.__atl(m), () => window.__atlFail());`;
    doc.body.appendChild(script);
  });
}
/** Counts full-screen openings, so a late take-down never undoes a newer one. */
let fullGen = 0;

export default function AtelierWindow() {
  // What opened it (null: closed), whether it is full screen, and whether it
  // is on its way out.
  const [from, setFrom] = useState<From | null>(null);
  const [full, setFull] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [closing, setClosing] = useState(false);
  // Closing, step one: the 3D has been let go and the window shows its still
  // (the poster) while the page is built again behind it. Only then does it
  // fade, so what is seen goes atelier, still, page: never a blank screen.
  const [returning, setReturning] = useState(false);
  // Once opened it stays mounted, asleep (display: none stops its frame
  // loop), so opening it again is instant rather than a second start-up.
  const [ever, setEver] = useState(false);
  // Warming: mounted and drawing, but invisible, ahead of being opened.
  const [warm, setWarm] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const closingRef = useRef(false);
  // Set when the window closes itself after IDLE_RETURN_MS: the page is then
  // put back at the top, on the hero.
  const homeRef = useRef(false);
  // Set once the 3D has drawn its first frames (mountAtelier's onLive).
  const liveRef = useRef(false);

  const open = useCallback((how: From) => {
    if (openRef.current) return;
    openRef.current = true;
    setLeaving(false);
    setFull(how !== "exit");
    setFrom(how);
    setEver(true);
  }, []);

  const close = useCallback(() => {
    if (!openRef.current || closingRef.current) return;
    closingRef.current = true;
    // Where the page comes back (template.tsx): the top, when it closed
    // itself after idling; otherwise where it was.
    if (homeRef.current) (window as Window & { __pageReturnY?: number }).__pageReturnY = 0;
    // The tap answers at once: the scene and its button fade to the frame's
    // dark ground (a CSS animation, so it runs while the page is rebuilt).
    // On the client's iPhone 12 the scene otherwise stood still for seconds
    // after Close while the page was built behind it (23 Nov).
    setClosing(true);
    // Two frames later, with the fade under way: the 3D goes and the page
    // comes back behind the dark ground; the whole window then fades out once
    // the page is back (template.tsx sends app:page-back), or soon after.
    requestAnimationFrame(() => requestAnimationFrame(teardown));
    const teardown = () => {
      setReturning(true);
      let faded = false;
      const fade = () => {
        if (faded) return;
        faded = true;
        window.removeEventListener("app:page-back", onBack);
        setLeaving(true);
        window.setTimeout(finish, CLOSE_MS);
      };
      // Faded the moment the page is back: closing should answer at once.
      const onBack = () => fade();
      // The page was never taken down (the exit invite, not full screen): no wait.
      if (!document.body.classList.contains("atelier-full")) {
        window.setTimeout(fade, 0);
      } else {
        window.addEventListener("app:page-back", onBack);
        window.setTimeout(fade, REBUILD_AFTER_MS + 800);
      }
    };
    const finish = () => {
      openRef.current = false;
      closingRef.current = false;
      setFrom(null);
      setLeaving(false);
      setClosing(false);
      setReturning(false);
      // Let it go entirely, rather than keep it asleep for an instant
      // reopening: kept, it and the page together ran an iPhone out of
      // memory (22 Nov: the reloads landed as the idle atelier closed itself).
      setEver(false);
      setWarm(false);
      liveRef.current = false;
      window.dispatchEvent(new Event("app:atelier-closed"));
      if (homeRef.current) {
        homeRef.current = false;
        window.dispatchEvent(new CustomEvent("app:scroll-set", { detail: { y: 0 } }));
      }
    };
  }, []);

  // Shown from idle and left alone, it hands back to the hero.
  useEffect(() => {
    if (from !== "idle") return;
    let id = 0;
    const arm = () => {
      window.clearTimeout(id);
      id = window.setTimeout(() => {
        homeRef.current = true;
        close();
      }, IDLE_RETURN_MS);
    };
    const inputs = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of inputs) window.addEventListener(e, arm, { passive: true });
    arm();
    return () => {
      window.clearTimeout(id);
      for (const e of inputs) window.removeEventListener(e, arm);
    };
  }, [from, close]);

  // Asked for from anywhere on the page.
  useEffect(() => {
    const onOpen = (e: Event) => open(((e as CustomEvent).detail?.from as From) ?? "menu");
    // Warm it up unseen: 8 s before the idle screen (IdleScreen sends this),
    // and the moment the menu opens, where its link is.
    // Warming fetches the code and nothing more. It used to start the whole 3D
    // window, unseen, behind the live page: on a phone that was the page and
    // the atelier at once, and the next scroll after a pause reloaded the tab
    // (22 Nov, iPhone 12). Every device the same: it starts when it is opened.
    const onPrewarm = () => {
      void loadSource().catch(() => {});
    };
    window.addEventListener("app:atelier-open", onOpen);
    window.addEventListener("app:atelier-prewarm", onPrewarm);
    // The menu opening (the Navbar sets body.menu-open).
    let menuWas = document.body.classList.contains("menu-open");
    const mo = new MutationObserver(() => {
      const now = document.body.classList.contains("menu-open");
      // Not on a phone: there the 3D window loading unseen behind the open
      // menu ran the tab out of memory (21 Nov: open the menu over the
      // services section, wait, and the page reloaded within two minutes),
      // the same crash the warm-up on load was already kept off phones for
      // (below). A phone loads it when the Atelier is asked for.
      if (now && !menuWas && !isPhoneDevice()) onPrewarm();
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
  // It ends WARM_AFTER_LIVE_MS after the window first goes live, or after WARM_MS at the most.
  useEffect(() => {
    if (!warm) return;
    let end = 0;
    const cap = window.setTimeout(() => setWarm(false), WARM_MS);
    const poll = window.setInterval(() => {
      if (!liveRef.current || end) return;
      end = window.setTimeout(() => setWarm(false), WARM_AFTER_LIVE_MS);
    }, 250);
    return () => {
      window.clearTimeout(cap);
      window.clearInterval(poll);
      window.clearTimeout(end);
    };
  }, [warm]);

  // Loaded on the way in: once the curtain is up and the page has settled, it warms up once, unseen. Computers only (a fine
  // pointer that hovers): on a phone the whole 3D window loading behind the hero ran it out of memory (3 Nov: the hero
  // lagged, its effects stopped, then the page crashed and reloaded), so phones, and connections asking to save data,
  // wait for it to be asked for as before.
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let cancelled = false;
    let timer = 0;
    let idle = 0;
    const start = () => {
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (conn?.saveData) return;
      const go = () => {
        if (!cancelled) window.dispatchEvent(new Event("app:atelier-prewarm"));
      };
      // Only in a pause. Its first frame holds the main thread for about a
      // second (the 3D window compiling), and fired on a timer it landed in
      // the middle of a scroll as a one-second freeze (measured, 21 Nov:
      // 1.1 s, every desktop run). So it waits for QUIET_MS without a scroll,
      // a wheel, a key or a touch.
      // The code is fetched now, so that what follows a pause is the compile
      // and nothing else (fetched after the pause, the compile came seconds
      // later, back in the scroll).
      let loaded = false;
      void loadSource().then(() => (loaded = true), () => {});
      const wait = () => {
        if (cancelled) return;
        if (!loaded || performance.now() - lastInput < QUIET_MS) {
          timer = window.setTimeout(wait, 500);
          return;
        }
        if ("requestIdleCallback" in window) idle = window.requestIdleCallback(go, { timeout: 5_000 });
        else go();
      };
      timer = window.setTimeout(wait, PRELOAD_AFTER_MS);
    };
    const QUIET_MS = 2_500;
    let lastInput = performance.now();
    const onInput = () => (lastInput = performance.now());
    const inputs = ["scroll", "wheel", "keydown", "touchstart", "pointerdown"] as const;
    for (const e of inputs) window.addEventListener(e, onInput, { passive: true });
    if ((window as Window & { __appUncovered?: boolean }).__appUncovered) start();
    else window.addEventListener("app:uncovered", start, { once: true });
    return () => {
      cancelled = true;
      for (const e of inputs) window.removeEventListener(e, onInput);
      window.removeEventListener("app:uncovered", start);
      window.clearTimeout(timer);
      if (idle && "cancelIdleCallback" in window) window.cancelIdleCallback(idle);
    };
  }, []);

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
    if (!from || returning) return;
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
  }, [from, returning, close]);

  // Full screen: the page under it is not seen, so the template takes it down
  // (template.tsx) and every scene on it gives its memory back. On any device:
  // the page's scenes plus the atelier's were more than an iPhone 12 holds
  // (22 Nov: it reloaded within a minute of the atelier opening anywhere
  // below the hero), and a modest laptop or tablet is no richer.
  // Kept through the closing fade: the page comes back once the window is gone.
  //
  // On the way out the page waits two frames after the 3D is destroyed (the
  // effect below, in the same commit) before it is built again. Built in the
  // same instant, the page's scenes and the not-yet-released atelier were in
  // memory together: on the client's iPhone 12 that drew two critical memory
  // warnings and froze the tab, which then reloaded (23 Nov).
  useEffect(() => {
    if (!from || !full || returning) return;
    const b = document.body;
    const gen = ++fullGen;
    b.classList.add("atelier-full");
    return () => {
      window.setTimeout(() => {
        // Opened again meanwhile: it is still full screen.
        if (gen === fullGen) b.classList.remove("atelier-full");
      }, REBUILD_AFTER_MS);
    };
  }, [from, full, returning]);

  // The window itself, mounted the first time it is opened.
  useEffect(() => {
    const el = hostRef.current;
    if (!ever || returning || !el) return;
    let handle: { destroy(): void } | null = null;
    let frame: HTMLIFrameElement | null = null;
    let gone = false;
    loadAtelier(el)
      .then(({ mod, frame: f, root }) => {
        frame = f;
        if (gone) f.remove();
        else handle = mod.mountAtelier(root, { assetBase: BASE, onLive: () => (liveRef.current = true) });
      })
      .catch(() => {});
    return () => {
      gone = true;
      // Its GPU memory now, so the page coming back has the room.
      handle?.destroy();
      handle = null;
      // The frame, and with it the module's whole realm, once the window has
      // faded: tearing a realm down (and the collection after it) held the
      // main thread for ~2 s on the client's iPhone 12, and done first it
      // kept the page from showing for that long after Close (23 Nov).
      const f = frame;
      frame = null;
      window.setTimeout(() => f?.remove(), CLOSE_MS + 600);
      releaseDetachedContexts();
    };
  }, [ever, returning]);

  if (!ever) return null;
  return (
    <div
      className="atl"
      hidden={!from && !warm}
      data-warming={!from && warm ? "" : undefined}
      data-from={from ?? undefined}
      data-full={full ? "" : undefined}
      data-leaving={leaving ? "" : undefined}
      data-closing={closing ? "" : undefined}
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
