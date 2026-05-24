"use client";

import {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Image from "next/image";

gsap.registerPlugin(useGSAP);

const NAV_ITEMS = [
  { label: "Home", href: "#home" },
  { label: "Services", href: "#services" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const Navbar = forwardRef<{ triggerEntrance: () => void }>(
  function Navbar(props, ref) {
    const navRef = useRef<HTMLDivElement>(null);
    const mobileMenuRef = useRef<HTMLDivElement>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

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
            duration: 0.9,
            ease: "power4.out",
          });
        }
      },
    }));

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

    const hamburgerRef = useRef<HTMLButtonElement>(null);

    useGSAP(
      () => {
        if (!hamburgerRef.current) return;

        const line1 = hamburgerRef.current.querySelector(".ham-line-1");
        const line2 = hamburgerRef.current.querySelector(".ham-line-2");
        const line3 = hamburgerRef.current.querySelector(".ham-line-3");

        if (!line1 || !line2 || !line3) return;

        if (isMenuOpen) {
          const tl = gsap.timeline({
            defaults: { duration: 0.6, ease: "power4.out" },
          });

          tl.to(line1, {
            rotation: 45,
            y: 6,
            transformOrigin: "center center",
          })
            .to(
              line2,
              {
                opacity: 0,
                scaleX: 0,
                transformOrigin: "center center",
              },
              0,
            )
            .to(
              line3,
              {
                rotation: -45,
                y: -6,
                transformOrigin: "center center",
              },
              0,
            );
        } else {
          const tl = gsap.timeline({
            defaults: { duration: 0.6, ease: "power4.out" },
          });

          tl.to(line1, {
            rotation: 0,
            y: 0,
            transformOrigin: "center center",
          })
            .to(
              line2,
              {
                opacity: 1,
                scaleX: 1,
                transformOrigin: "center center",
              },
              0,
            )
            .to(
              line3,
              {
                rotation: 0,
                y: 0,
                transformOrigin: "center center",
              },
              0,
            );
        }
      },
      { dependencies: [isMenuOpen], scope: hamburgerRef },
    );

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    return (
      <>
        <nav
          ref={navRef}
          className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-100 will-change-transform w-[calc(100%-2rem)] max-w-[56rem]"
        >
          <div className="relative px-5 md:px-6 py-4 md:py-3 flex items-center justify-center rounded-3xl border border-white/10 bg-[#38000E]/50 backdrop-blur-xl ">
            {/* Desktop nav links — centered */}
            <ul className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <NavLink href={item.href}>{item.label}</NavLink>
                </li>
              ))}
            </ul>

            {/* Mobile hamburger — left side on mobile */}
            <button
              ref={hamburgerRef}
              onClick={toggleMenu}
              className="md:hidden absolute left-5 w-9 h-9 flex items-center justify-center text-foreground hover:text-title-red group transition-all duration-300 hover:scale-110 active:scale-95"
              aria-label="Toggle menu"
            >
              <AnimatedHamburger />
            </button>

            {/* Logo — right side */}
            <a
              href="#home"
              className="absolute right-5 md:right-6 flex items-center gap-2 group will-change-transform shrink-0"
            >
              <div className="relative w-7 h-7 md:w-[52px] md:h-[52px] overflow-hidden rounded-lg">
                <Image
                  src="/logo.png"
                  alt="Zuhayr Creative"
                  fill
                  sizes="(max-width: 768px) 28px, 52px"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  priority
                />
              </div>
            </a>
          </div>
        </nav>

        <div
          ref={mobileMenuRef}
          className="fixed inset-0 z-90 hidden md:hidden items-center justify-center will-change-transform overflow-hidden bg-black/70 backdrop-blur-2xl"
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
  },
);

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
      className="group relative block px-4 py-2 text-foreground/85 text-base font-medium tracking-tight hover:text-foreground transition-colors duration-300 overflow-hidden rounded-sm active:scale-90"
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      <div
        className="absolute inset-0 scale-x-0 group-hover:scale-x-100 transition-transform duration-800 ease-[cubic-bezier(0.25,1.3,0.5,1)] origin-left rounded-sm"
        style={{ backgroundColor: "rgba(80,0,15,0.88)" }}
      />
      <span className="relative z-10">{children}</span>
    </a>
  );
}

function AnimatedHamburger() {
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
      className="will-change-transform"
    >
      <line
        className="ham-line-1"
        x1="3"
        y1="6"
        x2="21"
        y2="6"
        style={{ transformOrigin: "center center" }}
      />
      <line
        className="ham-line-2"
        x1="3"
        y1="12"
        x2="21"
        y2="12"
        style={{ transformOrigin: "center center" }}
      />
      <line
        className="ham-line-3"
        x1="3"
        y1="18"
        x2="21"
        y2="18"
        style={{ transformOrigin: "center center" }}
      />
    </svg>
  );
}

export default Navbar;
