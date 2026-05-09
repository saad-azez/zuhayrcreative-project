"use client";

import { useRef, useState, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Image from "next/image";

gsap.registerPlugin(useGSAP);

const NAV_ITEMS = [
  { label: "Work", href: "#work" },
  { label: "Services", href: "#services" },
  { label: "Journal", href: "#journal" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useGSAP(
    () => {
      if (!mobileMenuRef.current) return;

      const menuItems =
        mobileMenuRef.current.querySelectorAll(".mobile-nav-item");

      if (isMenuOpen) {
        gsap.set(mobileMenuRef.current, { display: "flex" });

        const tl = gsap.timeline();

        tl.fromTo(
          mobileMenuRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.3, ease: "power3.out" },
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
          "-=0.1",
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
          "-=0.1",
        );
      }
    },
    { dependencies: [isMenuOpen], scope: mobileMenuRef },
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
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-100 will-change-transform w-[95%] max-w-7xl">
        <div className="relative px-4 md:px-10 py-4 md:py-5 rounded-full flex items-center justify-between overflow-hidden bg-maroon-dark/40 backdrop-blur-[20px] backdrop-saturate-[2] shadow-[0_4px_12px_rgba(71,0,21,0.7),0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.2)]">
          <a
            href="#home"
            className="flex items-center gap-2 group will-change-transform"
          >
            <div className="relative w-8 h-8 md:w-9 md:h-9 overflow-hidden rounded-lg">
              <Image
                src="/logo.png"
                alt="Zuhayr Creative"
                fill
                sizes="(max-width: 768px) 32px, 36px"
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                priority
              />
            </div>
            <span className="text-foreground text-sm font-medium tracking-tight hidden sm:block">
              Zuhayr Creative™
            </span>
          </a>

          <div className="hidden md:flex items-center gap-1">
            <span className="text-foreground/50 text-xs tracking-tight mr-6">
              ©Since — 2018
            </span>
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <NavLink href={item.href}>{item.label}</NavLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <span className="text-foreground/60 text-xs tracking-tight">
              3 Slots Open — May
            </span>
            <a
              href="#contact"
              className="px-5 py-2 rounded-full bg-title-red/90 text-white text-sm font-medium tracking-tight hover:bg-title-red transition-colors will-change-transform"
            >
              Let&apos;s Talk
            </a>
          </div>

          <button
            onClick={toggleMenu}
            className="md:hidden flex items-center justify-center text-foreground transition-colors hover:text-title-red"
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
        <nav className="flex flex-col items-center gap-8">
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

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="group relative block px-4 py-2 text-foreground/85 text-sm font-medium tracking-tight hover:text-foreground transition-colors duration-300"
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      <div className="absolute inset-0 bg-foreground/8 -z-10 scale-x-0 group-hover:scale-x-100 transition-transform duration-400 ease-out origin-left" />
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
