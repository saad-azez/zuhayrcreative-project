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
import LiquidGlass from "./LiquidGlass";

gsap.registerPlugin(useGSAP);

const NAV_ITEMS = [
  { label: "Home", href: "/#home" },
  { label: "Services", href: "/#services" },
  { label: "Work", href: "/#work" },
  { label: "Clients", href: "/#clients" },
  { label: "Workflow", href: "/#workflow" },
  { label: "About", href: "/#about" },
  { label: "Presentation", href: "/#presentation" },
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
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { prefersReducedMotion } = useDeviceDetect();

    // Logo ⇄ menu-icon roller (GSAP-driven so it isn't subject to CSS
    // animation quirks / reduced-motion overrides).
    const rollRef = useRef<HTMLSpanElement>(null);
    const rollTlRef = useRef<gsap.core.Timeline | null>(null);
    const hoverTweenRef = useRef<gsap.core.Tween | null>(null);
    const isHoverRef = useRef(false);
    const menuWasOpenRef = useRef(false);

    // Refs for the infinite scroll engine
    const itemEls = useRef<(HTMLAnchorElement | null)[]>([]);
    const scrollPos = useRef(0);
    const targetPos = useRef(0);
    const animating = useRef(false);
    const velocity = useRef(0);
    const lastTouch = useRef(0);
    const isTouching = useRef(false);



    useImperativeHandle(ref, () => ({
      triggerEntrance: () => {
        if (navRef.current) {
          gsap.set(navRef.current, { y: 20 });
          gsap.to(navRef.current, {
            opacity: 1,
            y: 0,
            duration: prefersReducedMotion ? 0.2 : 0.7,
            ease: "power3.out",
            onComplete: () => {
              // Show the logo first, then begin the roller loop.
              if (!isMenuOpen) rollTlRef.current?.restart();
            },
          });
        }
      },
    }));

    // Render loop — runs at 60fps via rAF, uses lerp for smoothness
    const render = useCallback(() => {
      if (!animating.current) return;

      // Lerp toward target — smooth inertia
      scrollPos.current += (targetPos.current - scrollPos.current) * 0.1;

      const vh = window.innerHeight;
      const centerY = vh / 2;
      // How many px of scroll = full rotation range
      const range = vh * 0.55;

      for (let i = 0; i < itemEls.current.length; i++) {
        const el = itemEls.current[i];
        if (!el) continue;

        // Shortest wrap distance from scroll center
        let rawY = (i * ITEM_HEIGHT - scrollPos.current) % TOTAL_HEIGHT;
        if (rawY > TOTAL_HEIGHT / 2) rawY -= TOTAL_HEIGHT;
        if (rawY < -TOTAL_HEIGHT / 2) rawY += TOTAL_HEIGHT;

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

      requestAnimationFrame(render);
    }, []);

    // Start/stop render loop with menu
    useEffect(() => {
      if (isMenuOpen) {
        scrollPos.current = 0;
        targetPos.current = 0;
        velocity.current = 0;
        animating.current = true;
        requestAnimationFrame(render);
      } else {
        animating.current = false;
      }
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

    // Lock body scroll
    useEffect(() => {
      document.body.style.overflow = isMenuOpen ? "hidden" : "";
      return () => { document.body.style.overflow = ""; };
    }, [isMenuOpen]);

    const toggleMenu = useCallback(() => setIsMenuOpen((prev) => !prev), []);
    const closeMenu = useCallback(() => setIsMenuOpen(false), []);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isMenuOpen) closeMenu();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [isMenuOpen, closeMenu]);

    // Build the looping logo ⇄ menu-icon roll timeline. Starts paused — the
    // entrance animation kicks it off so the logo is shown first on load.
    useGSAP(
      () => {
        const el = rollRef.current;
        if (!el) return;
        gsap.set(el, { yPercent: 0 });
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });
        tl.to(el, { yPercent: -50, duration: 0.5, ease: "power3.inOut" }, 0.6) // roll up to menu icon
          .to(el, { yPercent: 0, duration: 0.5, ease: "power3.inOut" }, 1.7); // roll back down to logo
        rollTlRef.current = tl;
      },
      { scope: navRef },
    );

    // While the menu is open, hold on the close icon; resume the loop on close.
    useEffect(() => {
      const el = rollRef.current;
      const tl = rollTlRef.current;
      if (!el || !tl) return;
      if (isMenuOpen) {
        menuWasOpenRef.current = true;
        tl.pause();
        hoverTweenRef.current?.kill();
        hoverTweenRef.current = gsap.to(el, {
          yPercent: -50,
          duration: 0.3,
          ease: "power2.out",
        });
      } else if (menuWasOpenRef.current) {
        // Only resume after a real open→close (not on initial mount).
        menuWasOpenRef.current = false;
        hoverTweenRef.current?.kill();
        hoverTweenRef.current = gsap.to(el, {
          yPercent: 0,
          duration: 0.3,
          ease: "power3.out",
          onComplete: () => tl.restart(), // back at logo → clean loop restart
        });
      }
    }, [isMenuOpen]);

    // Hover in: pause the loop and roll up to settle on the menu icon (if the
    // logo is showing it slides up and the menu icon slides in from below; if
    // the menu icon is already there it just stops).
    const startHover = useCallback(() => {
      if (isMenuOpen) return;
      isHoverRef.current = true;
      rollTlRef.current?.pause();
      hoverTweenRef.current?.kill();
      hoverTweenRef.current = gsap.to(rollRef.current, {
        yPercent: -50,
        duration: 0.4,
        ease: "power3.out",
      });
    }, [isMenuOpen]);

    // Hover out: roll the other way — menu icon slides back down and the logo
    // returns from the top — then resume the continuous loop.
    const stopHover = useCallback(() => {
      if (isMenuOpen) return;
      isHoverRef.current = false;
      hoverTweenRef.current?.kill();
      hoverTweenRef.current = gsap.to(rollRef.current, {
        yPercent: 0,
        duration: 0.35,
        ease: "power3.out",
        onComplete: () => {
          if (!isHoverRef.current && !isMenuOpen) rollTlRef.current?.restart();
        },
      });
    }, [isMenuOpen]);

    return (
      <>
        <nav
          ref={navRef}
          className="fixed top-4 md:top-6 left-3 md:left-5 z-100 will-change-transform"
          style={{ opacity: 0, transform: "translateY(20px)" }}
        >
          {/* Logo / menu toggle — vertical roller: logo at rest, menu icon on hover */}
          <button
            onClick={toggleMenu}
            onMouseEnter={startHover}
            onMouseLeave={stopHover}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            className="group relative block w-14 h-14 md:w-16 md:h-16 overflow-hidden rounded-[10px] active:scale-95 transition-transform duration-200 touch-target"
          >
            {/* Liquid glass — WebGL refraction/sheen over the frosted backdrop */}
            <LiquidGlass radius={10} tint="#470015" />

            <span ref={rollRef} className="relative z-10 flex flex-col">
              {/* Logo cell (visible at rest) */}
              <span className="h-14 md:h-16 w-full shrink-0 flex items-center justify-center">
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

              {/* Menu icon cell (rolls up on hover / when open) */}
              <span className="h-14 md:h-16 w-full shrink-0 flex items-center justify-center text-white">
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
            </span>
          </button>
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
                onClick={closeMenu}
                className="absolute left-0 block text-[clamp(4.5rem,16vw,13rem)] font-medium tracking-[-0.03em] leading-[1] text-white hover:text-[#dc143c] transition-colors duration-150 will-change-transform select-none"
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
