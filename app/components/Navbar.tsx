"use client";


import {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";
import { useMagnetic } from "@/app/animations/hooks/useMagnetic";
import LiquidGlass from "./LiquidGlass";

gsap.registerPlugin(useGSAP);

// Each href maps to a real section id on the home page (#…) or a real route.
const NAV_ITEMS = [
  // Stays a clean "/" so the address bar never picks up a hash. Clicking it
  // while already on the home page is handled in handleNavClick, which scrolls
  // back to the top instead of re-navigating to the route you are on.
  { label: "Home", href: "/" },
  { label: "Services", href: "/#services" },
  { label: "Work", href: "/#work" },
  // Seasons — the club globe, now a section on the home page (#seasons).
  { label: "Seasons", href: "/#seasons" },
  // Hidden — their sections (reviews / below-footer) are currently hidden.
  // { label: "Clients", href: "/#testimonials" },
  // { label: "About", href: "/#about" },
  { label: "Career", href: "/career" },
  { label: "Club", href: "/club" },
  { label: "Contact", href: "/contact" },
];

const ITEM_HEIGHT = 145;
const TOTAL_HEIGHT = NAV_ITEMS.length * ITEM_HEIGHT;

const Navbar = forwardRef<{ triggerEntrance: () => void }>(
  function Navbar(_props, ref) {
    const navRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    // Magnetic pull on the toggle — wraps the button so it can't fight the
    // button's own hover/active transforms.
    const toggleWrapRef = useRef<HTMLSpanElement>(null);
    useMagnetic(toggleWrapRef, { strength: 0.28, radius: 52 });
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // Entrance is driven by React state (not a GSAP tween on the <nav>): a tween
    // here gets clobbered when the template re-renders to hide the loader, which
    // resets the nav's inline opacity/transform and leaves it invisible. State
    // persists across re-renders, so the navbar stays revealed.
    const [entered, setEntered] = useState(false);
    const { prefersReducedMotion } = useDeviceDetect();

    // Logo ⇄ menu-icon crossfade (two overlapping layers, GSAP-driven so it
    // isn't subject to CSS animation quirks / reduced-motion overrides).
    const logoRef = useRef<HTMLSpanElement>(null);
    const iconRef = useRef<HTMLSpanElement>(null);
    const rollTlRef = useRef<gsap.core.Timeline | null>(null);
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
            if (!isMenuOpen) rollTlRef.current?.restart();
          },
          prefersReducedMotion ? 220 : 720,
        );
      },
    }));

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
      if (Math.abs(diff) < 0.5) scrollPos.current = targetPos.current;

      const vh = vhRef.current;
      if (
        scrollPos.current === lastPaintedPos.current &&
        vh === lastPaintedVh.current
      ) {
        requestAnimationFrame(render);
        return;
      }
      lastPaintedPos.current = scrollPos.current;
      lastPaintedVh.current = vh;

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
        el.style.pointerEvents = opacity > 0.2 ? "auto" : "none";
        // Items overlap (glyph box is taller than ITEM_HEIGHT), so the one
        // closest to centre must paint on top to be fully hoverable.
        el.style.zIndex = `${1000 - Math.round(Math.abs(rawY))}`;
      }

      // Only touch the DOM when the accented item actually changes.
      if (accentIdx !== accentIdxRef.current) {
        itemEls.current[accentIdxRef.current]?.removeAttribute("data-accent");
        itemEls.current[accentIdx]?.setAttribute("data-accent", "true");
        accentIdxRef.current = accentIdx;
      }

      requestAnimationFrame(render);
    }, []);

    // Start/stop render loop with menu
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

    // Touch handlers
    useEffect(() => {
      if (!isMenuOpen || !menuRef.current) return;
      const el = menuRef.current;

      const onTouchStart = (e: TouchEvent) => {
        isTouching.current = true;
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

      const onTouchEnd = () => {
        isTouching.current = false;
        // Apply momentum
        const applyMomentum = () => {
          if (isTouching.current || Math.abs(velocity.current) < 0.3) return;
          velocity.current *= 0.94;
          targetPos.current += velocity.current;
          requestAnimationFrame(applyMomentum);
        };
        requestAnimationFrame(applyMomentum);
      };

      el.addEventListener("touchstart", onTouchStart, { passive: true });
      el.addEventListener("touchmove", onTouchMove, { passive: false });
      el.addEventListener("touchend", onTouchEnd, { passive: true });

      return () => {
        el.removeEventListener("touchstart", onTouchStart);
        el.removeEventListener("touchmove", onTouchMove);
        el.removeEventListener("touchend", onTouchEnd);
      };
    }, [isMenuOpen]);

    // Menu open/close
    useGSAP(
      () => {
        if (!menuRef.current) return;

        if (isMenuOpen) {
          gsap.set(menuRef.current, { display: "flex" });
          gsap.fromTo(
            menuRef.current,
            { opacity: 0 },
            { opacity: 1, duration: 0.35, ease: "power2.out" },
          );
        } else {
          gsap.to(menuRef.current, {
            opacity: 0,
            duration: 0.25,
            ease: "power2.in",
            onComplete: () => {
              if (menuRef.current) gsap.set(menuRef.current, { display: "none" });
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
      return () => {
        document.body.style.overflow = "";
        document.body.classList.remove("menu-open");
        window.dispatchEvent(new Event("app:scroll-unlock"));
      };
    }, [isMenuOpen]);

    const toggleMenu = useCallback(() => setIsMenuOpen((prev) => !prev), []);
    const closeMenu = useCallback(() => setIsMenuOpen(false), []);

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
          closeMenu();
          // Wait for the close animation + scroll-unlock, same as the anchors.
          window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("app:scroll-to", { detail: { target: 0 } }),
            );
          }, 420);
          return;
        }
        const id = href.slice(hashIndex + 1);
        if (typeof document === "undefined" || !document.getElementById(id)) {
          closeMenu(); // target lives on another page — let the link navigate
          return;
        }
        e.preventDefault();
        closeMenu();
        // Wait for the close animation + scroll-unlock before scrolling.
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("app:scroll-to", { detail: { target: `#${id}` } }),
          );
        }, 420);
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
        gsap.set(logo, { opacity: 1, scale: 1 });
        gsap.set(icon, { opacity: 0, scale: 1, rotate: 0 });
        sweepRef.current = 0;
        flameProxyRef.current.p = 0;

        const proxy = flameProxyRef.current;
        const setSweep = () => { sweepRef.current = proxy.p; };
        const SWEEP = 1.3; // flame travel time, each direction
        const HOLD = 1.75; // dwell on the logo / menu icon
        const down = HOLD;                  // flame starts sweeping down
        const up = HOLD + SWEEP + HOLD;     // flame starts sweeping back up

        const tl = gsap.timeline({ repeat: -1, paused: true });
        // Flame wipes down; swap logo → menu icon behind the band.
        tl.to(proxy, { p: 1, duration: SWEEP, ease: "power1.inOut", onUpdate: setSweep }, down)
          .to(logo, { opacity: 0, scale: 0.85, duration: 0.2, ease: "power2.in" }, down + SWEEP * 0.42)
          .to(icon, { opacity: 1, scale: 1, duration: 0.2, ease: "power2.out" }, down + SWEEP * 0.5)
          // Flame wipes back up; swap menu icon → logo behind the band.
          .to(proxy, { p: 0, duration: SWEEP, ease: "power1.inOut", onUpdate: setSweep }, up)
          .to(icon, { opacity: 0, scale: 0.85, duration: 0.2, ease: "power2.in" }, up + SWEEP * 0.42)
          .to(logo, { opacity: 1, scale: 1, duration: 0.2, ease: "power2.out" }, up + SWEEP * 0.5);
        rollTlRef.current = tl;
      },
      { scope: navRef },
    );

    // Snap back to the resting logo state and restart the master loop. Used
    // after hover / menu-close so a paused mid-sweep flame band doesn't linger.
    const resetLoop = useCallback(() => {
      const tl = rollTlRef.current;
      if (!tl) return;
      flameProxyRef.current.p = 0;
      sweepRef.current = 0;
      gsap.set(logoRef.current, { opacity: 1, scale: 1 });
      gsap.set(iconRef.current, { opacity: 0, scale: 1 });
      tl.invalidate().restart();
    }, []);

    // On open: fade the logo out while the X spins/scales in (logo → X). On
    // close: reverse it and resume the loop.
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
          .fromTo(
            icon,
            { opacity: 0, scale: 0.5 },
            { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.7)" },
            0,
          );
      } else if (menuWasOpenRef.current) {
        // Only resume after a real open→close (not on initial mount).
        menuWasOpenRef.current = false;
        hoverTweenRef.current?.kill();
        hoverTweenRef.current = gsap
          .timeline({
            onComplete: () => {
              gsap.set(icon, { rotate: 0, scale: 1, opacity: 0 });
              if (!isHoverRef.current) resetLoop();
            },
          })
          .to(icon, { opacity: 0, scale: 0.5, duration: 0.25, ease: "power2.in" }, 0)
          .fromTo(
            logo,
            { opacity: 0, scale: 0.8 },
            { opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" },
            0.1,
          );
      }
    }, [isMenuOpen]);

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

    // Hover in: pause the loop and crossfade to the menu icon.
    const startHover = useCallback(() => {
      if (isMenuOpen) return;
      isHoverRef.current = true;
      rollTlRef.current?.pause();
      sweepRef.current = 0; // park the flame off-screen while previewing the icon
      crossfade(true, 0.35);
    }, [isMenuOpen, crossfade]);

    // Hover out: crossfade back to the logo, then resume the continuous loop.
    const stopHover = useCallback(() => {
      if (isMenuOpen) return;
      isHoverRef.current = false;
      crossfade(false, 0.35).eventCallback("onComplete", () => {
        if (!isHoverRef.current && !isMenuOpen) resetLoop();
      });
    }, [isMenuOpen, crossfade, resetLoop]);

    return (
      <>
        <nav
          ref={navRef}
          className="fixed top-[calc(var(--safe-top)+1rem)] md:top-[calc(var(--safe-top)+1.5rem)] left-[calc(var(--safe-left)+0.75rem)] md:left-[calc(var(--safe-left)+1.25rem)] z-100 will-change-transform"
          style={{
            opacity: entered ? 1 : 0,
            transform: entered ? "translateY(0px)" : "translateY(20px)",
            transition: prefersReducedMotion
              ? "opacity 0.2s ease, transform 0.2s ease"
              : "opacity 0.7s ease-out, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Logo / menu toggle — crossfade: logo at rest, menu icon on hover.
              Wrapped in a magnetic span so the toggle leans toward the cursor. */}
          <span ref={toggleWrapRef} className="inline-block will-change-transform">
          <button
            data-nav-toggle
            onClick={toggleMenu}
            onMouseEnter={startHover}
            onMouseLeave={stopHover}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            className="group relative block w-14 h-14 md:w-16 md:h-16 overflow-hidden rounded-[10px] bg-white/[0.05] border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-md active:scale-95 transition-transform duration-200 touch-target"
          >
            {/* Liquid glass — WebGL refraction/sheen + the flame band. Sits
                above the logo/icon layers (z-20) so the band visibly wipes
                over them; its sweep is driven in lock-step with the loop. */}
            <LiquidGlass radius={10} tint="#470015" sweepRef={sweepRef} className="z-20" />

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

            {/* Menu-icon layer (fades in on hover; becomes the X when open) */}
            <span ref={iconRef} className="absolute inset-0 z-10 flex items-center justify-center text-white">
              {isMenuOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </span>
          </button>
          </span>
        </nav>

        {/* Fullscreen Infinite Scroll Menu */}
        <div
          ref={menuRef}
          className="fixed inset-0 z-90 hidden flex-col bg-black/30 backdrop-blur-2xl cursor-grab active:cursor-grabbing"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div className="absolute inset-0 overflow-hidden" style={{ perspective: "900px", perspectiveOrigin: "50% 50%" }}>
            {NAV_ITEMS.map((item, i) => (
              <Link
                key={item.label}
                ref={(el) => { itemEls.current[i] = el; }}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="absolute left-0 block text-[clamp(4.5rem,16vw,13rem)] font-medium tracking-[-0.03em] leading-[1] text-white data-[accent=true]:text-[#C4010D] hover:text-[#C4010D] transition-colors duration-150 will-change-transform select-none"
                style={{
                  fontFamily: "var(--font-geist-sans)",
                  transformOrigin: "left center",
                  backfaceVisibility: "hidden",
                  transformStyle: "preserve-3d",
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </>
    );
  },
);



export default Navbar;
