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

const ITEM_HEIGHT = 110;
const TOTAL_HEIGHT = NAV_ITEMS.length * ITEM_HEIGHT;

const Navbar = forwardRef<{ triggerEntrance: () => void }>(
  function Navbar(_props, ref) {
    const navRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { prefersReducedMotion } = useDeviceDetect();

    // Refs for the infinite scroll engine
    const itemEls = useRef<(HTMLAnchorElement | null)[]>([]);
    const scrollPos = useRef(0);
    const targetPos = useRef(0);
    const animating = useRef(false);
    const velocity = useRef(0);
    const lastTouch = useRef(0);
    const isTouching = useRef(false);

    useEffect(() => {
      if (navRef.current) {
        gsap.set(navRef.current, { opacity: 0, y: 200 });
      }
    }, []);

    useImperativeHandle(ref, () => ({
      triggerEntrance: () => {
        if (navRef.current) {
          gsap.to(navRef.current, {
            opacity: 1,
            y: 0,
            duration: prefersReducedMotion ? 0.2 : 0.9,
            ease: "power4.out",
          });
        }
      },
    }));

    // Render loop — runs at 60fps via rAF, uses lerp for smoothness
    const render = useCallback(() => {
      if (!animating.current) return;

      // Lerp toward target
      scrollPos.current += (targetPos.current - scrollPos.current) * 0.12;

      const vh = window.innerHeight;
      const centerY = vh / 2;
      // Wheel radius — controls how tightly items curl
      const radius = vh * 0.55;
      // Max angle to render — beyond this, hide
      const maxAngle = Math.PI * 0.55;

      for (let i = 0; i < itemEls.current.length; i++) {
        const el = itemEls.current[i];
        if (!el) continue;

        // Find shortest wrap distance from scroll center
        let rawY = (i * ITEM_HEIGHT - scrollPos.current) % TOTAL_HEIGHT;
        if (rawY > TOTAL_HEIGHT / 2) rawY -= TOTAL_HEIGHT;
        if (rawY < -TOTAL_HEIGHT / 2) rawY += TOTAL_HEIGHT;

        // Angle around the wheel — rawY = arc length, radius defines curl
        const angle = rawY / radius;

        if (Math.abs(angle) > maxAngle) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          continue;
        }

        // Position on cylinder — y mapped via sin
        const y = centerY + Math.sin(angle) * radius - ITEM_HEIGHT / 2;
        // Item rotates to follow the tangent of the circle
        const rotationDeg = angle * (180 / Math.PI);
        // Cosine-based scale and opacity for natural perspective
        const cosA = Math.cos(angle);
        const scale = 0.65 + cosA * 0.35;
        const opacity = Math.max(0, cosA);

        el.style.transform = `translate3d(0, ${y}px, 0) rotate(${rotationDeg}deg) scale(${scale})`;
        el.style.opacity = `${opacity}`;
        el.style.pointerEvents = opacity > 0.3 ? "auto" : "none";
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

    return (
      <>
        <nav
          ref={navRef}
          className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-100 will-change-transform w-[calc(100%-2rem)] max-w-4xl"
        >
          <div className="relative px-5 md:px-6 py-4 md:py-3 flex items-center justify-between rounded-3xl border border-white/10 bg-[#38000E]/50 backdrop-blur-xl">
            <button
              onClick={toggleMenu}
              className="w-11 h-11 flex items-center justify-center text-foreground hover:text-title-red transition-all duration-300 hover:scale-110 active:scale-95 touch-target"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? (
                /* X / Close icon */
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line className="ham-line-1" x1="5" y1="5" x2="19" y2="19" />
                  <line className="ham-line-3" x1="19" y1="5" x2="5" y2="19" />
                </svg>
              ) : (
                /* Hamburger icon */
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line className="ham-line-1" x1="3" y1="6" x2="21" y2="6" />
                  <line className="ham-line-2" x1="3" y1="12" x2="21" y2="12" />
                  <line className="ham-line-3" x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>

            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <div className="relative w-7 h-7 md:w-13 md:h-13 overflow-hidden rounded-lg">
                <Image
                  src="/logo.png"
                  alt="Zuhayr Creative"
                  fill
                  sizes="(max-width: 768px) 28px, 52px"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  priority
                />
              </div>
            </Link>
          </div>
        </nav>

        {/* Fullscreen Infinite Scroll Menu */}
        <div
          ref={menuRef}
          className="fixed inset-0 z-90 hidden flex-col bg-black cursor-grab active:cursor-grabbing"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div className="absolute inset-0 overflow-hidden">
            {NAV_ITEMS.map((item, i) => (
              <Link
                key={item.label}
                ref={(el) => { itemEls.current[i] = el; }}
                href={item.href}
                onClick={closeMenu}
                className="absolute left-6 sm:left-12 md:left-20 lg:left-28 block text-[clamp(3rem,11vw,8rem)] font-medium tracking-[-0.03em] leading-[1] text-white hover:text-[#dc143c] transition-colors duration-150 will-change-transform select-none"
                style={{
                  fontFamily: "var(--font-geist-sans)",
                  transformOrigin: "left center",
                  backfaceVisibility: "hidden",
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <button
            onClick={closeMenu}
            className="absolute top-6 right-6 z-10 w-11 h-11 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="4" x2="20" y2="20" />
              <line x1="20" y1="4" x2="4" y2="20" />
            </svg>
          </button>
        </div>
      </>
    );
  },
);

export default Navbar;
