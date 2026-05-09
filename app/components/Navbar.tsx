"use client";

import { useRef, useState, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Image from "next/image";

gsap.registerPlugin(useGSAP);

const NAV_ITEMS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Projects", href: "#projects" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useGSAP(
    () => {
      if (!mobileMenuRef.current) return;

      const menuItems = mobileMenuRef.current.querySelectorAll(".mobile-nav-item");

      if (isMenuOpen) {
        gsap.set(mobileMenuRef.current, { display: "flex" });

        const tl = gsap.timeline();

        tl.fromTo(
          mobileMenuRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.3, ease: "power3.out" }
        );

        tl.fromTo(
          menuItems,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: "power3.out",
            stagger: 0.08,
          },
          "-=0.1"
        );
      } else {
        const tl = gsap.timeline({
          onComplete: () => {
            gsap.set(mobileMenuRef.current, { display: "none" });
          },
        });

        tl.to(menuItems, {
          opacity: 0,
          y: -20,
          duration: 0.3,
          ease: "power3.in",
          stagger: 0.04,
        });

        tl.to(
          mobileMenuRef.current,
          { opacity: 0, duration: 0.2, ease: "power3.in" },
          "-=0.1"
        );
      }
    },
    { dependencies: [isMenuOpen], scope: mobileMenuRef }
  );

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <>
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-100 will-change-transform w-[95%] max-w-6xl">
        <div className="relative px-6 md:px-8 py-3 md:py-4 rounded-full flex items-center justify-between overflow-hidden bg-maroon-dark/40 backdrop-blur-[20px] backdrop-saturate-[2] shadow-[0_8px_32px_rgba(71,0,21,0.7),0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.2)]">
          <div
            className="absolute inset-0 opacity-30 pointer-events-none mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
          <a
            href="#home"
            className="relative z-10 flex items-center gap-3 group will-change-transform"
          >
            <div className="relative w-8 h-8 md:w-10 md:h-10 overflow-hidden rounded-lg">
              <Image
                src="/logo.png"
                alt="Zuhayr Creative"
                fill
                sizes="(max-width: 768px) 32px, 40px"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                priority
              />
            </div>
            
          </a>

          <ul className="relative z-10 hidden md:flex items-center gap-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <NavLink href={item.href}>{item.label}</NavLink>
              </li>
            ))}
          </ul>

          <button
            onClick={toggleMenu}
            className="relative z-10 md:hidden flex items-center justify-center text-foreground transition-colors hover:text-title-red"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </nav>

      <div
        ref={mobileMenuRef}
        className="fixed inset-0 z-90 hidden md:hidden items-center justify-center will-change-transform overflow-hidden bg-footer/88 backdrop-blur-[20px] backdrop-saturate-[1.8]"
      >
        <div
          className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
        <nav className="relative z-10 flex flex-col items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={toggleMenu}
              className="mobile-nav-item text-foreground text-4xl font-semibold tracking-tight hover:text-title-red transition-colors will-change-transform"
              style={{ fontFamily: "var(--font-geist-sans)" }}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const hoverBgRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!linkRef.current || !hoverBgRef.current) return;

      const link = linkRef.current;
      const bg = hoverBgRef.current;

      gsap.set(bg, { scaleX: 0, transformOrigin: "left center" });

      const handleMouseEnter = () => {
        gsap.to(bg, {
          scaleX: 1,
          duration: 0.4,
          ease: "expo.out",
        });
      };

      const handleMouseLeave = () => {
        gsap.to(bg, {
          scaleX: 0,
          duration: 0.3,
          ease: "power3.in",
        });
      };

      link.addEventListener("mouseenter", handleMouseEnter);
      link.addEventListener("mouseleave", handleMouseLeave);

      return () => {
        link.removeEventListener("mouseenter", handleMouseEnter);
        link.removeEventListener("mouseleave", handleMouseLeave);
      };
    },
    { scope: linkRef }
  );

  return (
    <a
      ref={linkRef}
      href={href}
      className="relative block px-5 py-2 text-foreground/90 text-sm font-medium tracking-tight hover:text-title-red transition-colors will-change-transform"
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      <div
        ref={hoverBgRef}
        className="absolute inset-0 rounded-full will-change-transform bg-title-red/15 -z-10"
      />
      <span className="relative z-10">{children}</span>
    </a>
  );
}

function MenuIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
