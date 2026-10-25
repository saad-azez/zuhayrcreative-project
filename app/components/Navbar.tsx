"use client";


import {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
  Fragment,
  useSyncExternalStore,
} from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import LiquidGlass from "./LiquidGlass";
import ChromaticMetal from "./ChromaticMetal";
import { createNavRipple, type NavRipple } from "./navRipple";
import { NAV_ITEMS } from "./navItems";
import NavHud from "./NavHud";
import "@/app/styles/navbar.css";
import { readHeroVariant } from "@/app/lib/heroVariant";

// The model draft (?hero=model) adds a quiet way into the atelier to the menu.
const noSubscribe = () => () => {};
const isModel = () => readHeroVariant() === "model";
const serverModel = () => false;

gsap.registerPlugin(useGSAP);

/* The glass panel round the toggle — the liquid-glass pane and the chrome
   rim — is off, and the glyph stands bare in the top left corner (client,
   12 Oct: "remove the glass panel around the menu/logo icon and then make
   sure to reposition the icon to the top left corner"). Flip to true to
   bring the 56/64px glass button back exactly where it was.

   The flame is NOT part of what went. It left with the panel on 12 Oct
   because it was drawn by the panel's layer, and it was missed (client,
   14 Oct: "the flame of the original nav bar got removed"): it is what
   carries the glyph from logo to menu icon and back. It sweeps the bare
   glyph now, with a soft edge where the panel's edge used to cut it
   (.nav-toggle-flame in navbar.css). */
const TOGGLE_GLASS: boolean = false;
/* The strip of section names along the top (NavHud), a trial alongside the
   fullscreen menu (client, 12 Oct: "keep both the current nav bar and this
   new HUD I want to see how the two look together"). */
const SHOW_HUD: boolean = true;
/* The toggle's lines take this long to fold into the × and back: both beats
   of the glyph's transition in navbar.css. */
const BURGER_S = 0.46;

/* The site's cursor is a 30px logo that rides on the pointer (GlobalCursor).
   On the glass button that was a logo on a pane; on the bare glyph it is a
   logo on top of the whole 20px glyph, hiding the very fold it is there to
   click. So it steps aside while the pointer is on the bare toggle. */
const setCursorOverToggle = (on: boolean) => {
  if (TOGGLE_GLASS) return;
  document.querySelector(".gallery-cursor")?.classList.toggle("over-toggle", on);
};

const ITEM_HEIGHT = 145;
const TOTAL_HEIGHT = NAV_ITEMS.length * ITEM_HEIGHT;

const Navbar = forwardRef<{ triggerEntrance: () => void }>(
  function Navbar(_props, ref) {
    const navRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    /* The toggle used to be magnetic — pulled toward the cursor on an
       underdamped spring that overshot and wobbled back. The client asked
       for that wiggle to go; the button now sits still, and a click sends
       the wave across the screen instead (navRipple). */
    const toggleRef = useRef<HTMLButtonElement>(null);
    const rippleRef = useRef<NavRipple | null>(null);
    // The menu's words layer: what the wave bends where the screen-wide
    // backdrop route cannot run (every iPhone browser; see navRipple).
    const wheelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      rippleRef.current = createNavRipple(() => wheelRef.current);
      return () => {
        rippleRef.current?.dispose();
        rippleRef.current = null;
      };
    }, []);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // Mirrors isMenuOpen for callbacks that fire after a delay and must not
    // act on the state they were created with.
    const openRef = useRef(false);
    openRef.current = isMenuOpen;
    // Entrance is driven by React state (not a GSAP tween on the <nav>): a tween
    // here gets clobbered when the template re-renders to hide the loader, which
    // resets the nav's inline opacity/transform and leaves it invisible. State
    // persists across re-renders, so the navbar stays revealed.
    const [entered, setEntered] = useState(false);
    const { prefersReducedMotion, isDesktop } = useDeviceDetect();
    // On the desktop layout the toggle has no logo: it is the menu icon, and
    // the flame passes over it without turning it into anything (client,
    // 14 Oct: "when you add back the flame for the nav bar also remove the
    // logo only in the desktop version"). Phones and tablets keep the logo ⇄
    // flame ⇄ icon loop. A ref as well, for the callbacks that are not
    // re-made when it changes.
    const logoOff = isDesktop;
    const logoOffRef = useRef(logoOff);
    logoOffRef.current = logoOff;

    // Logo ⇄ menu-icon crossfade (two overlapping layers, GSAP-driven so it
    // isn't subject to CSS animation quirks / reduced-motion overrides).
    const logoRef = useRef<HTMLSpanElement>(null);
    const iconRef = useRef<HTMLSpanElement>(null);
    const rollTlRef = useRef<gsap.core.Timeline | null>(null);
    // True while the hero is on screen. Over the hero the toggle is LOCKED to
    // the menu icon and never swaps to the logo — the hero already carries the
    // Zuhayr Creative lockup at full size (client, 3 Oct: "for only the hero
    // section we had locked the nav bar menu icon to not switch to the logo",
    // reinstating 23 Aug's 62de40e, which 8 Sep's 4101a54 had taken out).
    // Everywhere else the logo ⇄ flame ⇄ icon loop runs as before. Read by
    // the loop's entry points, which are otherwise free to bring the logo
    // back on their own.
    const inHeroRef = useRef(false);
    const [inHero, setInHero] = useState(false);
    const hoverTweenRef = useRef<gsap.core.Animation | null>(null);
    const isHoverRef = useRef(false);
    const menuWasOpenRef = useRef(false);

    // Drives the flame band in LiquidGlass (0 = parked off top / logo shown,
    // 1 = parked off bottom / menu icon shown). The master loop and the
    // hover/menu transitions all animate this so the flame stays in lock-step
    // with the logo⇄icon crossfade. flameProxyRef is the GSAP tween target.
    const sweepRef = useRef(0);
    const flameProxyRef = useRef({ p: 0 });

    // Refs for the infinite scroll engine
    const itemEls = useRef<(HTMLAnchorElement | null)[]>([]);
    // Which menu item currently carries the brand accent (nearest the centre).
    const accentIdxRef = useRef(-1);
    // Which item the pointer is on, or -1. Read by the render loop, which is the
    // single owner of the accent — see the note there. Set a beat AFTER the
    // pointer arrives, not on contact: the goo melts the word first and the
    // accent lights as it re-forms (see startGoo).
    const hoverIdxRef = useRef(-1);
    // Gooey hover — the label spans, their filters' blur nodes, and the tweens.
    const labelEls = useRef<(HTMLSpanElement | null)[]>([]);
    const blurEls = useRef<(SVGFEGaussianBlurElement | null)[]>([]);
    // The SAME filter, declared twice per item. iOS Safari does not re-render
    // an element whose CSS `filter: url(#id)` still names the same filter when
    // only that filter's primitives changed underneath it: the melt ran — the
    // stdDeviation really did animate, measured — but the glyphs never moved,
    // which is why the effect was there on a desktop and absent on a phone.
    // Alternating between two identical defs changes the filter STRING every
    // frame, and a changed style is not something WebKit can serve from cache.
    const blurElsB = useRef<(SVGFEGaussianBlurElement | null)[]>([]);
    const gooTls = useRef<(gsap.core.Timeline | null)[]>([]);
    const accentCalls = useRef<(gsap.core.Tween | null)[]>([]);
    // The phone's melt (see runMelt): the word that last melted on landing
    // in the centre, so a settle does not melt the same word twice, and
    // whether the pointer can hover at all.
    const lastMeltedRef = useRef(-1);
    const noHoverRef = useRef(false);
    // What the reader is actually using: the pointerType of the last pointer
    // that went down (see the open effect for why the media query alone was
    // not enough).
    const lastPointerTypeRef = useRef("");
    // The opening: the wheel has not moved, so there is no settle to catch;
    // the word the menu opens on melts on the loop's first frame instead.
    const meltOnOpenRef = useRef(false);
    const lastPaintedHoverRef = useRef(-1);
    const scrollPos = useRef(0);
    const targetPos = useRef(0);
    const animating = useRef(false);
    const velocity = useRef(0);
    const lastTouch = useRef(0);
    const isTouching = useRef(false);
    // Perf: viewport height cached per open/resize (not read per frame), and
    // the last painted state so settled frames skip all DOM writes.
    const vhRef = useRef(0);
    const lastPaintedPos = useRef(NaN);
    const lastPaintedVh = useRef(0);



    useImperativeHandle(ref, () => ({
      triggerEntrance: () => {
        // Reveal the navbar (state-driven; see `entered` above) and, once it has
        // slid in, kick off the logo⇄flame roll loop.
        setEntered(true);
        window.setTimeout(
          () => {
            // The entrance is the one place that STARTS the roll loop (it is
            // created paused, on the logo): the logo shows as the navbar
            // slides in, and the loop's first flame sweep follows. Not over
            // the hero, where the toggle is locked to the icon — starting the
            // loop there would fade the logo back in a beat after the curtain
            // cleared.
            if (!isMenuOpen && !inHeroRef.current) rollTlRef.current?.restart();
          },
          prefersReducedMotion ? 220 : 720,
        );
      },
    }));

    /**
     * The melt itself — the filter tween, with no say over the accent. Shared
     * by the desktop hover (startGoo) and the phone's landing (render).
     */
    const GOO_HALF = 0.4; // seconds — melt, then re-form
    /**
     * Peak blur, as a FRACTION OF THE FONT SIZE — not a fixed pixel value.
     *
     * The reference's `stdDeviation: 1` is in the units of its SVG viewBox,
     * which is 20 tall for ~16-unit text: about 6% of the glyph height, which is
     * why its letters visibly swell and merge. Copying the number 1 into CSS
     * pixel space on text that is clamp(4.5rem, 16vw, 13rem) — roughly 230px on
     * a desktop — is a 0.4% blur, which is to say none at all. Scaling it off
     * the measured font size keeps the effect identical at every size the clamp
     * produces.
     */
    const GOO_BLUR_RATIO = 0.06;

    const runMelt = useCallback((i: number) => {
      const span = labelEls.current[i];
      const blur = blurEls.current[i];
      if (!span || !blur) return false;

      gooTls.current[i]?.kill();
      // Measured at melt time, so it tracks the clamp across viewport sizes.
      const fontPx = parseFloat(getComputedStyle(span).fontSize) || 100;
      const peak = fontPx * GOO_BLUR_RATIO;

      // Promoted for the length of the melt: a filtered element inside the
      // menu's preserve-3d / backface-hidden context is the case WebKit is
      // least reliable about re-rasterising. Dropped again on complete, so the
      // seven words do not each sit on a layer of their own for the visit.
      span.style.willChange = "filter";
      span.style.filter = `url(#nav-goo-${i})`;

      const blurB = blurElsB.current[i];
      const proxy = { v: 0 };
      // Write the value into the def we are ABOUT to name, then name it — see
      // blurElsB. Falls back to the single def if the second one is missing.
      let flip = 0;
      const write = () => {
        flip ^= 1;
        const useB = flip === 0 && !!blurB;
        (useB ? blurB : blur).setAttribute("stdDeviation", `${proxy.v}`);
        span.style.filter = `url(#nav-goo-${i}${useB ? "-b" : ""})`;
      };
      gooTls.current[i] = gsap
        .timeline({
          onComplete: () => {
            span.style.filter = "none";
            span.style.willChange = "";
          },
        })
        .to(proxy, { v: peak, duration: GOO_HALF, ease: "none", onUpdate: write })
        .to(proxy, { v: 0, duration: GOO_HALF, ease: "none", onUpdate: write });
      return true;
    }, []);

    // Render loop — runs via rAF while the menu is open; lerp for smoothness.
    // Once the scroll settles, frames skip ALL DOM writes: rewriting identical
    // transforms every frame kept style-recalc (and the overlay's viewport-
    // wide backdrop blur) hot even when nothing was moving.
    const render = useCallback(() => {
      if (!animating.current) return;

      // Lerp toward target — smooth inertia; snap when the remaining gap is
      // sub-pixel so the loop can actually go idle instead of chasing an
      // asymptote forever.
      const diff = targetPos.current - scrollPos.current;
      scrollPos.current += diff * 0.1;
      const settling =
        Math.abs(diff) < 0.5 && scrollPos.current !== targetPos.current;
      if (Math.abs(diff) < 0.5) scrollPos.current = targetPos.current;

      const vh = vhRef.current;
      // The hover index is part of what a frame paints — the accent follows it.
      // Without it in this guard the loop skipped every frame once the scroll
      // settled, so pointing at a word while the menu sat still never moved the
      // accent: it only ever changed while you were also scrolling.
      if (
        scrollPos.current === lastPaintedPos.current &&
        vh === lastPaintedVh.current &&
        hoverIdxRef.current === lastPaintedHoverRef.current
      ) {
        requestAnimationFrame(render);
        return;
      }
      lastPaintedPos.current = scrollPos.current;
      lastPaintedVh.current = vh;
      lastPaintedHoverRef.current = hoverIdxRef.current;

      const centerY = vh / 2;
      // How many px of scroll = full rotation range
      const range = vh * 0.55;

      // Item nearest the centre — carries the brand accent. Hover alone left
      // touch devices with no accent at all, since they never hover.
      let accentIdx = -1;
      let accentDist = Infinity;

      for (let i = 0; i < itemEls.current.length; i++) {
        const el = itemEls.current[i];
        if (!el) continue;

        // Shortest wrap distance from scroll center
        let rawY = (i * ITEM_HEIGHT - scrollPos.current) % TOTAL_HEIGHT;
        if (rawY > TOTAL_HEIGHT / 2) rawY -= TOTAL_HEIGHT;
        if (rawY < -TOTAL_HEIGHT / 2) rawY += TOTAL_HEIGHT;

        if (Math.abs(rawY) < accentDist) {
          accentDist = Math.abs(rawY);
          accentIdx = i;
        }

        // Normalized position: 0=center, negative=above, positive=below
        const t = rawY / range;

        if (Math.abs(t) > 1.3) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          continue;
        }

        // Linear vertical position — items stack naturally
        const y = centerY + rawY - ITEM_HEIGHT / 2;

        // Y-axis rotation from LEFT edge — tornado/vortex spin
        // Items are always visually upright; only Y-axis angle changes
        const rotateYDeg = -t * 65;

        // Asymmetric scale: items below center grow bigger (incoming feel),
        // items above center shrink (receding feel). Toned down so items
        // can pack closer without colliding.
        // Asymmetric scale: items below center grow bigger (incoming feel),
        // items above center shrink (receding feel)
        const scale = t > 0
          ? Math.min(2.2, 1 + t * 0.72)
          : Math.max(0.25, 1 + t * 0.55);

        // Cosine falloff for opacity
        const cosT = Math.cos((t * Math.PI) / 2);
        const opacity = Math.max(0, cosT);

        el.style.transform = `translateY(${y}px) rotateY(${rotateYDeg}deg) scale(${scale})`;
        el.style.opacity = `${opacity}`;
        const hit = opacity > 0.2 ? "auto" : "none";
        if (el.style.pointerEvents !== hit) el.style.pointerEvents = hit;
        // Items overlap (glyph box is taller than ITEM_HEIGHT), so the one
        // closest to centre must paint on top to be fully hoverable.
        //
        // Written ONLY when it changes. These sit inside a `perspective` /
        // `preserve-3d` context, where a z-index write forces the browser to
        // re-sort the stacking context and recomposite the 3D scene — it is
        // the one write in this loop that is not compositor-cheap. It used to
        // be set every frame for all seven, and because the value tracks
        // sub-pixel motion it changed almost every frame, so it never
        // coalesced. Rounding to a coarser step makes it change rarely.
        const z = `${1000 - (Math.round(Math.abs(rawY)) >> 2)}`;
        if (el.style.zIndex !== z) el.style.zIndex = z;
      }

      // Hover WINS. The accent is otherwise "whichever item is nearest the
      // centre", which is scroll-driven — so pointing at a different word lit a
      // second one and two words were red at once. Pointing at a word moves the
      // single accent onto it; leaving hands it back to the centre item.
      if (hoverIdxRef.current >= 0) accentIdx = hoverIdxRef.current;

      // Only touch the DOM when the accented item actually changes.
      if (accentIdx !== accentIdxRef.current) {
        itemEls.current[accentIdxRef.current]?.removeAttribute("data-accent");
        itemEls.current[accentIdx]?.setAttribute("data-accent", "true");
        accentIdxRef.current = accentIdx;
      }

      // The phone's melt. A finger never hovers, so on a coarse pointer the
      // melt that the desktop plays on pointing at a word plays instead on
      // the word that LANDS in the centre: the flick spins the wheel, the
      // wheel settles, and the word it settled on melts and re-forms as
      // itself, lit. Once per landing (the same word does not melt twice in
      // a row), and only on the settle — not on every word that passes the
      // centre mid-flick, which would put seven live SVG filters on huge
      // glyphs at once, on the device least able to afford one.
      const landed = settling || meltOnOpenRef.current;
      meltOnOpenRef.current = false;
      if (
        noHoverRef.current &&
        landed &&
        !isTouching.current &&
        accentIdx >= 0 &&
        accentIdx !== lastMeltedRef.current
      ) {
        lastMeltedRef.current = accentIdx;
        runMelt(accentIdx);
      }

      requestAnimationFrame(render);
    }, [runMelt]);

    // Start/stop render loop with menu
    // Closing the menu mid-hover would otherwise leave a word stuck mid-melt,
    // with a live filter on it, waiting for a pointerleave that never comes.
    useEffect(() => {
      if (isMenuOpen) return;
      gooTls.current.forEach((tl) => tl?.kill());
      accentCalls.current.forEach((c) => c?.kill());
      labelEls.current.forEach((el) => {
        if (!el) return;
        el.style.filter = "none";
        el.style.willChange = "";
      });
      hoverIdxRef.current = -1;
    }, [isMenuOpen]);

    useEffect(() => {
      if (!isMenuOpen) {
        animating.current = false;
        return;
      }
      scrollPos.current = 0;
      targetPos.current = 0;
      velocity.current = 0;
      vhRef.current = window.innerHeight;
      lastPaintedPos.current = NaN; // force the first paint
      animating.current = true;
      requestAnimationFrame(render);

      // Track viewport height across the session instead of reading it per
      // frame inside the render loop.
      const onResize = () => {
        vhRef.current = window.innerHeight;
      };
      window.addEventListener("resize", onResize);
      return () => {
        window.removeEventListener("resize", onResize);
        animating.current = false;
      };
    }, [isMenuOpen, render]);

    // Wheel handler
    useEffect(() => {
      if (!isMenuOpen || !menuRef.current) return;
      const el = menuRef.current;

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        targetPos.current += e.deltaY * 0.6;
      };

      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [isMenuOpen]);

    // Every browser reports the type of the pointer that went down. Recorded
    // in the capture phase, so the tap that opens the menu has set it before
    // the open effect below reads it.
    useEffect(() => {
      const onDown = (e: PointerEvent) => {
        lastPointerTypeRef.current = e.pointerType;
      };
      window.addEventListener("pointerdown", onDown, { capture: true, passive: true });
      return () => window.removeEventListener("pointerdown", onDown, { capture: true });
    }, []);

    // The phone's melt needs to know it is on a phone — a pointer that
    // cannot hover — and starts each opening afresh, so the word the menu
    // opens on melts once as it lands.
    //
    // It used to ask matchMedia("(hover: none)") and nothing else, and phones
    // do not all say that: Samsung Internet, stylus phones and "Desktop site"
    // mode report "hover: hover" on a touchscreen, and there no word ever
    // melted (reproduced by overriding the query: the wheel landed, nothing
    // melted). The pointer that opened the menu is ground truth on every
    // browser; the media queries are only the fallback when there was none
    // (a keyboard), and a finger on the menu settles it (see onTouchStart).
    useEffect(() => {
      if (!isMenuOpen) return;
      const lastType = lastPointerTypeRef.current;
      noHoverRef.current =
        lastType === "touch" ||
        lastType === "pen" ||
        (lastType !== "mouse" &&
          (window.matchMedia("(hover: none)").matches ||
            window.matchMedia("(any-pointer: coarse)").matches));
      lastMeltedRef.current = -1;
      meltOnOpenRef.current = true;
    }, [isMenuOpen]);

    // Touch handlers
    useEffect(() => {
      if (!isMenuOpen || !menuRef.current) return;
      const el = menuRef.current;

      const onTouchStart = (e: TouchEvent) => {
        isTouching.current = true;
        noHoverRef.current = true;
        lastTouch.current = e.touches[0].clientY;
        velocity.current = 0;
      };

      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        const y = e.touches[0].clientY;
        const delta = lastTouch.current - y;
        velocity.current = delta;
        lastTouch.current = y;
        targetPos.current += delta * 1.5;
      };

      // The momentum chain has to be cancellable: it used to be a bare
      // requestAnimationFrame recursion with no handle kept, so a flick kept
      // running for a hundred-odd frames after the menu closed, and past
      // unmount.
      let momentumRaf = 0;
      const onTouchEnd = () => {
        isTouching.current = false;
        const applyMomentum = () => {
          if (isTouching.current || Math.abs(velocity.current) < 0.3) {
            momentumRaf = 0;
            return;
          }
          velocity.current *= 0.94;
          targetPos.current += velocity.current;
          momentumRaf = requestAnimationFrame(applyMomentum);
        };
        momentumRaf = requestAnimationFrame(applyMomentum);
      };

      el.addEventListener("touchstart", onTouchStart, { passive: true });
      el.addEventListener("touchmove", onTouchMove, { passive: false });
      el.addEventListener("touchend", onTouchEnd, { passive: true });
      // touchcancel ends a touch as surely as touchend does. Browsers send it
      // INSTEAD of touchend when the OS or the browser takes the gesture over
      // (an iOS home-bar or Control Centre swipe, an Android interruption).
      // Unhandled, isTouching stayed true for the rest of that visit to the
      // menu, and the landing melt, which waits for the finger to lift, never
      // fired again (reproduced: the wheel landed on Careers, nothing melted).
      el.addEventListener("touchcancel", onTouchEnd, { passive: true });

      return () => {
        if (momentumRaf) cancelAnimationFrame(momentumRaf);
        el.removeEventListener("touchstart", onTouchStart);
        el.removeEventListener("touchmove", onTouchMove);
        el.removeEventListener("touchend", onTouchEnd);
        el.removeEventListener("touchcancel", onTouchEnd);
      };
    }, [isMenuOpen]);

    // Menu open/close
    useGSAP(
      () => {
        if (!menuRef.current) return;

        // `overwrite: true` on both, and the close guarded by the state it
        // was started for.
        //
        // Without it, a click during the 0.35s fade left the open tween and a
        // stale close tween animating the same opacity at once — and when the
        // stale one finished it ran its onComplete and set display:none on a
        // menu that was supposed to be OPEN. The result was an invisible but
        // scroll-locked page showing a close icon, recoverable only by
        // toggling twice. That is the glitch on a slow device, where the
        // fades last long enough to click through.
        if (isMenuOpen) {
          const veil = menuRef.current;
          gsap.set(veil, { display: "flex" });
          gsap.fromTo(
            veil,
            { opacity: 0 },
            {
              opacity: 1,
              duration: 0.35,
              ease: "power2.out",
              overwrite: true,
              // The blur goes on only once the fade has landed, and comes off
              // before the fade out below. Neither animation ever runs with a
              // viewport-wide backdrop-filter attached.
              onComplete: () => {
                if (openRef.current) veil.classList.add("is-blurred");
              },
            },
          );
        } else {
          menuRef.current.classList.remove("is-blurred");
          gsap.to(menuRef.current, {
            opacity: 0,
            duration: 0.25,
            ease: "power2.in",
            overwrite: true,
            onComplete: () => {
              // Re-read the flag rather than trusting the closure: by the time
              // this runs the menu may have been reopened.
              if (menuRef.current && !openRef.current) {
                gsap.set(menuRef.current, { display: "none" });
              }
            },
          });
        }
      },
      { dependencies: [isMenuOpen] },
    );

    // Lock scroll while the menu is open — both native scroll and the
    // Locomotive/Lenis smooth scroll (which ignores body overflow:hidden).
    // Also flag the open state on <body> so other components (e.g. the hero
    // cursor logic) can react to it.
    useEffect(() => {
      document.body.style.overflow = isMenuOpen ? "hidden" : "";
      document.body.classList.toggle("menu-open", isMenuOpen);
      window.dispatchEvent(
        new Event(isMenuOpen ? "app:scroll-lock" : "app:scroll-unlock"),
      );
      // Announced as an event as well as a class. The class is a poll — fine
      // for something already running a frame loop — but the Unicorn scenes
      // need to STOP, and a scene cannot notice a class it never looks at.
      // The veil's backdrop-filter re-runs whenever anything behind it moves,
      // so the WebGL scenes underneath are the blur's running cost; paused,
      // the browser composites the frosted ground once and keeps it.
      // (`app:menu-close` already had a listener in ChromaticMetal that
      // nothing was firing.)
      window.dispatchEvent(
        new Event(isMenuOpen ? "app:menu-open" : "app:menu-close"),
      );
      return () => {
        document.body.style.overflow = "";
        document.body.classList.remove("menu-open");
        window.dispatchEvent(new Event("app:scroll-unlock"));
        window.dispatchEvent(new Event("app:menu-close"));
      };
    }, [isMenuOpen]);

    /**
     * Gooey hover, after the Codrops effect.
     *
     * Blur the word, then crush the blurred alpha back to hard edges: the
     * letterforms swell into blobs that run together and separate again. Ramping
     * the blur up and back down over the same hover melts the word and re-forms
     * it as itself.
     *
     * The reference does this on an SVG holding TWO <text> nodes, because there
     * the point is to swap one word for another. Melting a word back into itself
     * needs no second text — so the existing markup stays exactly as it was, and
     * the filter is simply applied to it. That also keeps the render loop's 3D
     * transforms, opacity and accent logic untouched.
     *
     * The filter is attached only for the length of the tween and removed after.
     * These are clamp(4.5rem, 16vw, 13rem) glyphs — leaving an SVG filter live on
     * seven of them would have the compositor re-filtering huge text every frame
     * for nothing.
     */
    const startGoo = useCallback((i: number) => {
      // A finger's "enter" is the tap itself, which navigates: the phone's
      // melt is the landing in render(), not this.
      if (noHoverRef.current) return;

      accentCalls.current[i]?.kill();
      // The accent lands as the word re-forms, not the instant the pointer
      // arrives — the melt reads first, then the word lights.
      accentCalls.current[i] = gsap.delayedCall(GOO_HALF, () => {
        hoverIdxRef.current = i;
      });

      if (!runMelt(i)) {
        hoverIdxRef.current = i; // no filter available — light it immediately
      }
    }, [runMelt]);

    const endGoo = useCallback((i: number) => {
      accentCalls.current[i]?.kill();
      accentCalls.current[i] = null;
      // The accent leaves at once — only its arrival is delayed.
      if (hoverIdxRef.current === i) hoverIdxRef.current = -1;
      // The melt is deliberately NOT reversed: it re-forms the same word either
      // way, so letting it finish is both simpler and less jarring than snapping
      // a half-melted word back.
    }, []);

    const toggleMenu = useCallback(() => {
      // The wave: born at the toggle's centre, across the whole screen —
      // the expanded images' ripple, let loose (navRipple.ts). Fired on the
      // way in AND the way out, since this is the one handler for both.
      const r = toggleRef.current?.getBoundingClientRect();
      if (r) {
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        // `fire` reports whether a wave actually ran. It cannot on an iPhone:
        // the backdrop route is Chromium's alone, and the element route bends
        // nothing there — it erases what it touches (see displaceWave). The
        // water can carry it instead, and does: the same app:splash the
        // gallery and the corner dock already use, at the widest train the
        // simulation is given. The toggle throws something across the screen
        // on open and on close on every device now, rather than only where a
        // displacement filter happens to work.
        const waved = rippleRef.current?.fire(cx, cy);
        if (!waved) {
          window.dispatchEvent(
            new CustomEvent("app:splash", { detail: { x: cx, y: cy } }),
          );
        }
      }
      setIsMenuOpen((prev) => !prev);
    }, []);
    const closeMenu = useCallback(() => setIsMenuOpen(false), []);
    const modelMenu = useSyncExternalStore(noSubscribe, isModel, serverModel);
    const openAtelier = useCallback(() => {
      const wait = openRef.current ? 420 : 0;
      closeMenu();
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("app:atelier-open", { detail: { from: "menu" } }));
      }, wait);
    }, [closeMenu]);

    // Nav item click. For an in-page anchor whose target exists on the current
    // page, close the menu and smooth-scroll to it (via the Locomotive/Lenis
    // provider, which listens for `app:scroll-to`). Otherwise let the <Link>
    // navigate normally (real routes, or anchors on another page).
    const handleNavClick = useCallback(
      (e: React.MouseEvent, href: string) => {
        const hashIndex = href.indexOf("#");
        if (hashIndex === -1) {
          // A hash-less entry is a real route. If the visitor is ALREADY on it
          // — Home while on "/" — then letting <Link> "navigate" there does
          // nothing visible and they stay parked wherever they had scrolled to.
          // Treat that as "take me back to the top" and scroll, keeping the URL
          // exactly as-is (no hash appended, no route change).
          const samePage =
            typeof window !== "undefined" && window.location.pathname === href;
          if (!samePage) {
            closeMenu(); // different route — let the link navigate normally
            return;
          }
          e.preventDefault();
          const wait = openRef.current ? 420 : 0;
          closeMenu();
          // Wait for the close animation + scroll-unlock, same as the anchors.
          window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("app:scroll-to", { detail: { target: 0 } }),
            );
          }, wait);
          return;
        }
        const id = href.slice(hashIndex + 1);
        if (typeof document === "undefined" || !document.getElementById(id)) {
          closeMenu(); // target lives on another page — let the link navigate
          return;
        }
        e.preventDefault();
        // Nothing to wait for when the click came from the HUD with the menu
        // shut.
        const wait = openRef.current ? 420 : 0;
        closeMenu();
        // Wait for the close animation + scroll-unlock before scrolling.
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("app:scroll-to", { detail: { target: `#${id}` } }),
          );
        }, wait);
      },
      [closeMenu],
    );

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isMenuOpen) closeMenu();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [isMenuOpen, closeMenu]);

    // Master loop, synchronised with the flame: logo shows → flame wipes DOWN
    // (top→bottom) and the menu icon is swapped in behind the band → holds →
    // flame wipes back UP (bottom→top) and the logo is swapped back in → repeat.
    // The logo/icon crossfades fire at mid-sweep, while the opaque flame band
    // covers the button, so each glyph appears to be revealed by the flame.
    // Starts paused — the entrance animation kicks it off so the logo shows
    // first on load.
    useGSAP(
      () => {
        const logo = logoRef.current;
        const icon = iconRef.current;
        if (!logo || !icon) return;
        // Re-made when the layout crosses between desktop and not (a window
        // resized, a tablet turned): the old loop goes first.
        rollTlRef.current?.kill();
        gsap.set(logo, { opacity: logoOff ? 0 : 1, scale: 1 });
        gsap.set(icon, { opacity: logoOff ? 1 : 0, scale: 1, rotate: 0 });
        sweepRef.current = 0;
        flameProxyRef.current.p = 0;

        const proxy = flameProxyRef.current;
        const setSweep = () => { sweepRef.current = proxy.p; };
        const SWEEP = 1.3; // flame travel time, each direction
        const HOLD = 1.75; // dwell on the logo / menu icon
        const down = HOLD;                  // flame starts sweeping down
        const up = HOLD + SWEEP + HOLD;     // flame starts sweeping back up

        const tl = gsap.timeline({ repeat: -1, paused: true });
        if (logoOff) {
          // No logo to turn into: the flame alone, down over the icon and,
          // after the same dwell, back up. The trailing dwell is the one the
          // logo used to have, so the flame comes round as often as it did.
          tl.to(proxy, { p: 1, duration: SWEEP, ease: "power1.inOut", onUpdate: setSweep }, down)
            .to(proxy, { p: 0, duration: SWEEP, ease: "power1.inOut", onUpdate: setSweep }, up);
        } else {
          // Flame wipes down; swap logo → menu icon behind the band.
          tl.to(proxy, { p: 1, duration: SWEEP, ease: "power1.inOut", onUpdate: setSweep }, down)
            .to(logo, { opacity: 0, scale: 0.85, duration: 0.2, ease: "power2.in" }, down + SWEEP * 0.42)
            .to(icon, { opacity: 1, scale: 1, duration: 0.2, ease: "power2.out" }, down + SWEEP * 0.5)
            // Flame wipes back up; swap menu icon → logo behind the band.
            .to(proxy, { p: 0, duration: SWEEP, ease: "power1.inOut", onUpdate: setSweep }, up)
            .to(icon, { opacity: 0, scale: 0.85, duration: 0.2, ease: "power2.in" }, up + SWEEP * 0.42)
            .to(logo, { opacity: 1, scale: 1, duration: 0.2, ease: "power2.out" }, up + SWEEP * 0.5);
        }
        rollTlRef.current = tl;
      },
      { scope: navRef, dependencies: [logoOff] },
    );

    // Snap back to the resting logo state and restart the master loop. Used
    // after hover / menu-close so a paused mid-sweep flame band doesn't linger.
    const resetLoop = useCallback(() => {
      const tl = rollTlRef.current;
      if (!tl) return;
      flameProxyRef.current.p = 0;
      sweepRef.current = 0;
      // Over the hero the resting glyph is the ICON and the loop stays parked.
      if (inHeroRef.current) {
        gsap.set(logoRef.current, { opacity: 0, scale: 1 });
        gsap.set(iconRef.current, { opacity: 1, scale: 1 });
        tl.pause();
        return;
      }
      // The resting glyph: the logo, or on the desktop layout the icon.
      const off = logoOffRef.current;
      gsap.set(logoRef.current, { opacity: off ? 0 : 1, scale: 1 });
      gsap.set(iconRef.current, { opacity: off ? 1 : 0, scale: 1 });
      tl.invalidate().restart();
    }, []);

    // The loop above was just re-made for the other layout, and is paused, as
    // a new one always is. If the navbar is already in and nothing else has
    // the glyph (the menu, a hover), set it going; over the hero resetLoop
    // parks it on the icon, as it should be there.
    const firstLayoutRef = useRef(true);
    useEffect(() => {
      if (firstLayoutRef.current) {
        firstLayoutRef.current = false;
        return;
      }
      if (!entered || openRef.current || menuWasOpenRef.current || isHoverRef.current) return;
      resetLoop();
      // `entered` is read, not followed: the entrance starts the loop itself.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logoOff, resetLoop]);

    /**
     * Watch the hero. `#hero-banner` only exists on the landing page, so every
     * other route never sets this and keeps the normal loop. An
     * IntersectionObserver fires twice a visit, not on every scroll frame.
     */
    useEffect(() => {
      const hero = document.getElementById("hero-banner");
      if (!hero) return;
      const io = new IntersectionObserver(
        ([entry]) => {
          inHeroRef.current = entry.isIntersecting;
          setInHero(entry.isIntersecting);
        },
        // Any part of the hero on screen counts as "in the hero".
        { threshold: 0 },
      );
      io.observe(hero);
      return () => io.disconnect();
    }, []);

    // Lock the glyph to the menu icon over the hero, and hand it back to the
    // loop on the way out. The menu's own open/close animation owns the glyph
    // while it is open, so stay out of its way — and on the render it shuts
    // in too (menuWasOpenRef is still set then: the effect below clears it).
    // Taking the glyph back here snapped the × away before it could unfold.
    useEffect(() => {
      const logo = logoRef.current;
      const icon = iconRef.current;
      if (!logo || !icon || isMenuOpen || menuWasOpenRef.current) return;

      if (inHero) {
        rollTlRef.current?.pause();
        sweepRef.current = 0; // park the flame band rather than freeze it mid-sweep
        hoverTweenRef.current?.kill();
        hoverTweenRef.current = gsap
          .timeline()
          .to(logo, { opacity: 0, scale: 0.85, duration: 0.3, ease: "power2.inOut" }, 0)
          .to(icon, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.inOut" }, 0);
        return;
      }

      // Left the hero. Only take the glyph back if a real mouse is not resting
      // on the button — the hover preview is showing the icon for its own
      // reasons. Asked the way the menu's close asks it (see there): a phone
      // leaves the last-tapped element in :hover and never sends mouseleave,
      // so isHoverRef alone would hold the loop paused after any tap.
      const hovered =
        lastPointerTypeRef.current === "mouse" &&
        !!document.querySelector("[data-nav-toggle]:hover");
      isHoverRef.current = hovered;
      if (!hovered) resetLoop();
    }, [inHero, isMenuOpen, resetLoop]);

    // Crossfade between the logo and menu-icon layers.
    const crossfade = useCallback((toIcon: boolean, dur: number) => {
      hoverTweenRef.current?.kill();
      const logo = logoRef.current;
      const icon = iconRef.current;
      const show = toIcon ? icon : logo;
      const hide = toIcon ? logo : icon;
      hoverTweenRef.current = gsap
        .timeline()
        .to(hide, { opacity: 0, scale: 0.85, duration: dur, ease: "power2.inOut" }, 0)
        .to(show, { opacity: 1, scale: 1, duration: dur, ease: "power2.inOut" }, 0);
      return hoverTweenRef.current;
    }, []);

    // On open: the logo, if it is the one showing, gives way to the menu
    // icon, whose three lines fold into the × (the fold itself is the glyph's
    // CSS, keyed off aria-expanded; see navbar.css). On close: the × unfolds,
    // and the loop resumes.
    //
    // The icon is faded TO full, never reset and popped in from nothing: that
    // pop was there to cover a swap of two drawings, and it hid the first
    // half of the fold whenever the icon was already the glyph on screen —
    // over the hero, or under a pointer that had come to click it, which is
    // to say nearly always.
    useEffect(() => {
      const logo = logoRef.current;
      const icon = iconRef.current;
      const tl = rollTlRef.current;
      if (!logo || !icon || !tl) return;
      if (isMenuOpen) {
        menuWasOpenRef.current = true;
        tl.pause();
        sweepRef.current = 0; // clear any frozen flame band while the menu is open
        hoverTweenRef.current?.kill();
        hoverTweenRef.current = gsap
          .timeline()
          .to(logo, { opacity: 0, scale: 0.7, duration: 0.25, ease: "power2.in" }, 0)
          .to(icon, { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" }, 0);
      } else if (menuWasOpenRef.current && inHeroRef.current) {
        // Closed over the hero: back to the menu icon, never through the logo.
        menuWasOpenRef.current = false;
        hoverTweenRef.current?.kill();
        tl.pause();
        sweepRef.current = 0;
        gsap.set(logo, { opacity: 0, scale: 1 });
        hoverTweenRef.current = gsap.to(icon, {
          opacity: 1,
          scale: 1,
          rotate: 0,
          duration: 0.3,
          ease: "power2.out",
        });
      } else if (menuWasOpenRef.current) {
        // Only resume after a real open→close (not on initial mount).
        menuWasOpenRef.current = false;
        hoverTweenRef.current?.kill();
        // Is a real pointer still resting on the button? Two things have to
        // be true and both are asked.
        //
        // `:hover` on its own is not evidence of a pointer. A touch device
        // leaves the element it last tapped in `:hover` indefinitely and
        // never sends mouseleave, so on every phone this latched isHoverRef
        // true, skipped the restart, and waited for a stopHover that could
        // not come. The loop stayed paused for the rest of the visit and the
        // glyph sat on the logo. So the pointer's TYPE is asked first — the
        // same ground truth the menu's melt already relies on (see the
        // pointerdown capture listener above), and the same lesson:
        // capability queries lie about phones, pointer events do not. With
        // no pointer at all, a keyboard say, the value is "" and the loop
        // simply resumes.
        const mouse = lastPointerTypeRef.current === "mouse";
        const hovered =
          mouse && !!document.querySelector("[data-nav-toggle]:hover");
        isHoverRef.current = hovered;
        if (hovered) {
          // The pointer never left the button — closing the menu by clicking
          // the very thing it is sitting on is the normal way to close it, so
          // this is the common case on a desktop, not an edge one. The hover
          // preview owns the glyph, and the preview is the MENU ICON: it
          // stays, and the × unfolds into its lines in plain view. stopHover
          // restarts the loop on the way out, as it does after any hover.
          gsap.set(logo, { opacity: 0, scale: 1 });
          hoverTweenRef.current = gsap.to(icon, {
            opacity: 1,
            scale: 1,
            rotate: 0,
            duration: 0.3,
            ease: "power2.out",
          });
        } else {
          // Nothing is holding the icon: let the × unfold first, so the way
          // out is seen as the way in was, then hand over to the logo. With
          // no logo (the desktop layout) the icon simply stays, and the loop
          // picks up once the × has unfolded.
          hoverTweenRef.current = logoOffRef.current
            ? gsap.delayedCall(BURGER_S, resetLoop)
            : gsap
                .timeline({ delay: BURGER_S, onComplete: resetLoop })
                .to(icon, { opacity: 0, scale: 0.85, duration: 0.25, ease: "power2.in" }, 0)
                .to(logo, { opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" }, 0.1);
        }
      }
    }, [isMenuOpen, resetLoop]);

    // Hover in: pause the loop and crossfade to the menu icon.
    // The pointer flag is recorded BEFORE the menu-open bail-out — see stopHover.
    const startHover = useCallback(() => {
      isHoverRef.current = true;
      setCursorOverToggle(true);
      if (isMenuOpen) return; // don't fight the menu's own open animation
      rollTlRef.current?.pause();
      sweepRef.current = 0; // park the flame off-screen while previewing the icon
      crossfade(true, 0.35);
    }, [isMenuOpen, crossfade]);

    // Hover out: crossfade back to the logo, then resume the continuous loop.
    //
    // Clearing the flag MUST happen before the menu-open bail-out. It used to
    // sit after it, so moving the pointer off the button while the menu was
    // open left isHoverRef stuck `true`; the menu-close handler then read that
    // stale flag, skipped resetLoop, and the roll timeline stayed paused for
    // good. From then on the only thing that ever swapped the glyphs was this
    // hover crossfade — which deliberately parks the flame at 0 — so the icon
    // appeared to change abruptly with no fire behind it.
    const stopHover = useCallback(() => {
      isHoverRef.current = false;
      setCursorOverToggle(false);
      if (isMenuOpen) return;
      // Over the hero the icon IS the resting state: crossfading back would
      // flash the logo on every hover-out.
      if (inHeroRef.current) return;
      // And so it is on the desktop layout, which has no logo to go back to:
      // the loop (the flame) just resumes.
      if (logoOffRef.current) {
        resetLoop();
        return;
      }
      crossfade(false, 0.35).eventCallback("onComplete", () => {
        if (!isHoverRef.current && !isMenuOpen) resetLoop();
      });
    }, [isMenuOpen, crossfade, resetLoop]);

    return (
      <>
        {SHOW_HUD && (
          <NavHud
            entered={entered}
            reducedMotion={prefersReducedMotion}
            onNavigate={handleNavClick}
          />
        )}

        <nav
          ref={navRef}
          // Bare, the toggle is tucked into the corner: a 44/48px target a
          // few px in, its glyph level with the HUD's names.
          className={`fixed z-100 will-change-transform ${
            TOGGLE_GLASS
              ? "top-[calc(var(--safe-top)+1rem)] md:top-[calc(var(--safe-top)+1.5rem)] left-[calc(var(--safe-left)+0.75rem)] md:left-[calc(var(--safe-left)+1.25rem)]"
              : "top-[calc(var(--safe-top)+0.25rem)] md:top-[calc(var(--safe-top)+0.5rem)] left-[calc(var(--safe-left)+0.25rem)] md:left-[calc(var(--safe-left)+0.5rem)]"
          }`}
          style={{
            opacity: entered ? 1 : 0,
            transform: entered ? "translateY(0px)" : "translateY(20px)",
            transition: prefersReducedMotion
              ? "opacity 0.2s ease, transform 0.2s ease"
              : "opacity 0.7s ease-out, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Logo / menu toggle — crossfade: logo at rest, menu icon on hover. */}
          <span className="inline-block">
          <button
            ref={toggleRef}
            data-nav-toggle
            onClick={toggleMenu}
            onMouseEnter={startHover}
            onMouseLeave={stopHover}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            className={
              TOGGLE_GLASS
                ? "liquid-glass group relative block w-14 h-14 md:w-16 md:h-16 overflow-hidden rounded-[10px] touch-target"
                : "nav-toggle-bare group relative block w-11 h-11 md:w-12 md:h-12 touch-target"
            }
          >
            {/* Liquid glass — WebGL refraction/sheen + the flame band. Sits
                above the logo/icon layers (z-20) so the band visibly wipes
                over them; its sweep is driven in lock-step with the loop. */}
            <LiquidGlass
              radius={10}
              tint="#470015"
              sweepRef={sweepRef}
              className={TOGGLE_GLASS ? "z-20" : "nav-toggle-flame z-20"}
              backing={!TOGGLE_GLASS}
            />

            {/* Chromatic-metal border — the flowing chrome rim, masked
                to the navbar toggle's edge (replaces the CSS conic rim
                while mounted). */}
            {TOGGLE_GLASS && <ChromaticMetal />}

            {/* Logo layer (visible at rest) */}
            <span ref={logoRef} className="absolute inset-0 z-10 flex items-center justify-center">
              <span className="relative w-7 h-7 md:w-9 md:h-9 overflow-hidden rounded-lg">
                <Image
                  src="/AI-9.png"
                  alt="Zuhayr Creative"
                  fill
                  sizes="(max-width: 768px) 28px, 36px"
                  className="object-cover"
                  priority
                />
              </span>
            </span>

            {/* Menu-icon layer (fades in on hover). ONE glyph for both
                states: its three lines fold into the × when the menu opens
                and back when it shuts (navbar.css, off aria-expanded). It
                used to be two drawings swapped on the state, which is a cut,
                not a movement. */}
            <span
              ref={iconRef}
              className="nav-burger-layer absolute inset-0 z-10 flex items-center justify-center text-white"
            >
              <span className="nav-burger" aria-hidden>
                <span className="nav-burger__bar" />
                <span className="nav-burger__bar" />
                <span className="nav-burger__bar" />
              </span>
            </span>
          </button>
          </span>
        </nav>

        {/* Fullscreen Infinite Scroll Menu */}
        <div
          ref={menuRef}
          // The blur is applied by a class toggled at open time, NOT baked in
          // here. `backdrop-blur-2xl` is a 40px blur over the whole viewport,
          // and this element's opacity is what the open/close animates — so
          // the browser re-ran a viewport-wide blur on every frame of both
          // fades. On a slow phone that was the most expensive 350ms on the
          // page. `menu-veil` (globals.css) holds the blur, drops it entirely
          // for coarse pointers and reduced motion in favour of a solid
          // ground, and is only added once the fade has finished.
          className="menu-veil fixed inset-0 z-90 hidden flex-col bg-black/30 cursor-grab active:cursor-grabbing"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div ref={wheelRef} className="absolute inset-0 overflow-hidden" style={{ perspective: "900px", perspectiveOrigin: "50% 50%" }}>
            {NAV_ITEMS.map((item, i) => (
              <Link
                key={item.label}
                ref={(el) => { itemEls.current[i] = el; }}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                onPointerEnter={() => startGoo(i)}
                onPointerLeave={() => endGoo(i)}
                // No `hover:` colour of its own: the render loop moves the single
                // accent onto the hovered item instead. A CSS hover rule here is
                // what produced two red words — it lit the pointed-at item while
                // the scroll-driven accent stayed lit on the centre one.
                className="absolute left-0 block text-[clamp(4.5rem,16vw,13rem)] font-medium tracking-[-0.03em] leading-[1] text-white data-[accent=true]:text-[#C4010D] transition-colors duration-150 will-change-transform select-none"
                style={{
                  fontFamily: "var(--font-departure)",
                  transformOrigin: "left center",
                  backfaceVisibility: "hidden",
                  transformStyle: "preserve-3d",
                }}
              >
                {/* The filter goes on this span, never on the <Link>. The link
                    carries the menu's 3D transform, and `filter` forces an
                    element into its own flattened layer — applied there it
                    would kill the tornado rotation the render loop drives. */}
                <span
                  ref={(el) => {
                    labelEls.current[i] = el;
                  }}
                  className="block"
                >
                  {item.label}
                </span>
              </Link>
            ))}

            {modelMenu && (
              <button
                type="button"
                className="nav-atelier"
                onClick={openAtelier}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <span>(</span>Atelier<span>)</span>
              </button>
            )}

            {/* Gooey filters — one per item so two can animate at once (leaving
                one word while entering the next) without sharing a blur value,
                and each declared TWICE (an "" and a "-b" copy) so the melt can
                alternate between them: see blurElsB for why iOS needs that.
                Zero-sized and hidden: this SVG exists only to host the filters,
                which are referenced from CSS on the spans above. */}
            <svg
              aria-hidden
              focusable="false"
              className="pointer-events-none absolute h-0 w-0"
            >
              <defs>
                {NAV_ITEMS.map((item, i) => (
                  <Fragment key={item.label}>
                    {(["", "-b"] as const).map((variant) => (
                      <filter id={`nav-goo-${i}${variant}`} key={variant}>
                        <feGaussianBlur
                          ref={(el) => {
                            if (variant === "") blurEls.current[i] = el;
                            else blurElsB.current[i] = el;
                          }}
                          in="SourceGraphic"
                          stdDeviation="0"
                          result="blur"
                        />
                        {/* Crushes the blurred alpha back to hard edges — blurred
                            letterforms become fat blobs that merge and separate.
                            The colour rows are identity so the accent red survives
                            the filter unchanged. */}
                        <feColorMatrix
                          in="blur"
                          mode="matrix"
                          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                          result="goo"
                        />
                        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                      </filter>
                    ))}
                  </Fragment>
                ))}
              </defs>
            </svg>
          </div>
        </div>
      </>
    );
  },
);



export default Navbar;
