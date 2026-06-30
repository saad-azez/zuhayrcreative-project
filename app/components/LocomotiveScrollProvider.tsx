"use client";

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import LocomotiveScroll from "locomotive-scroll";
import type { ILocomotiveScrollOptions } from "locomotive-scroll";

// ── Context ────────────────────────────────────────────────────────
interface LocoContextValue {
  locoScroll: LocomotiveScroll | null;
  update: () => void;
  scrollTo: (
    target: string | number | HTMLElement,
    options?: {
      offset?: number;
      duration?: number;
      easing?: (t: number) => number;
    },
  ) => void;
  isReady: boolean;
}

const LocoContext = createContext<LocoContextValue>({
  locoScroll: null,
  update: () => {},
  scrollTo: () => {},
  isReady: false,
});

export const useLocomotiveScroll = () => useContext(LocoContext);

// ── Provider ───────────────────────────────────────────────────────
interface Props {
  children: ReactNode;
  /** Delay init until this is true (e.g. after loading screen) */
  enabled?: boolean;
  /** Lenis lerp value — lower = smoother/floatier. Default 0.08 */
  lerp?: number;
  /** Wheel multiplier — higher = faster scroll. Default 1 */
  wheelMultiplier?: number;
  /** Mimic touch device scroll while allowing scroll sync. Default false */
  syncTouch?: boolean;
  /** CSS class for the scroll container */
  className?: string;
}

const defaultEasing = (t: number) => 1 - Math.pow(1 - t, 3); // ease-out cubic

export default function LocomotiveScrollProvider({
  children,
  enabled = true,
  lerp = 0.08,
  wheelMultiplier = 1,
  syncTouch = false,
  className,
}: Props) {
  const locoRef = useRef<LocomotiveScroll | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // ── Init / Destroy ──────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || locoRef.current) return;

    // Small delay to ensure DOM is painted before initializing
    const raf = requestAnimationFrame(() => {
      const options: ILocomotiveScrollOptions = {
        lenisOptions: {
          orientation: "vertical",
          lerp,
          smoothWheel: true,
          syncTouch,
          wheelMultiplier,
        },
      };

      locoRef.current = new LocomotiveScroll(options);
      setIsReady(true);
    });

    return () => {
      cancelAnimationFrame(raf);
      locoRef.current?.destroy?.();
      locoRef.current = null;
      setIsReady(false);
    };
    // Only re-init if `enabled` changes from false→true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── Update on resize / DOM mutations ────────────────────────────
  const update = useCallback(() => {
    locoRef.current?.resize?.();
  }, []);

  // ── Scroll-to helper ────────────────────────────────────────────
  const scrollTo = useCallback(
    (
      target: string | number | HTMLElement,
      options?: {
        offset?: number;
        duration?: number;
        easing?: (t: number) => number;
      },
    ) => {
      locoRef.current?.scrollTo?.(target, {
        offset: options?.offset ?? 0,
        duration: options?.duration ?? 1.2,
        easing: options?.easing ?? defaultEasing,
      });
    },
    [],
  );

  // ── Lock / unlock smooth scroll (e.g. while the menu is open) ───
  // The menu lives outside this provider, so it signals via window events.
  useEffect(() => {
    const lock = () => locoRef.current?.lenisInstance?.stop();
    const unlock = () => locoRef.current?.lenisInstance?.start();
    window.addEventListener("app:scroll-lock", lock);
    window.addEventListener("app:scroll-unlock", unlock);
    return () => {
      window.removeEventListener("app:scroll-lock", lock);
      window.removeEventListener("app:scroll-unlock", unlock);
    };
  }, []);

  // ── Scroll-to-section (e.g. from the nav menu, which is outside this
  //    provider and signals via a window event) ───────────────────────
  useEffect(() => {
    const onScrollTo = (e: Event) => {
      const target = (e as CustomEvent<{ target?: string | number }>).detail
        ?.target;
      if (target == null) return;
      if (locoRef.current?.scrollTo) {
        locoRef.current.lenisInstance?.start(); // ensure smoothing is live
        scrollTo(target, { offset: 0 });
      } else if (typeof target === "string") {
        // Locomotive not active (e.g. touch / not yet ready) — native fallback.
        document
          .querySelector(target)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("app:scroll-to", onScrollTo);
    return () => window.removeEventListener("app:scroll-to", onScrollTo);
  }, [scrollTo]);

  // ── Deep-link hash: when arriving at e.g. `/#services` from another page,
  //    smooth-scroll to that section once Locomotive is ready. The template
  //    skips its top-reset when a hash is present so we own the scroll here.
  useEffect(() => {
    if (!isReady) return;
    const hash = window.location.hash;
    if (hash.length < 2) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    // Let layout settle (images / WebGL) before measuring + scrolling.
    const t = window.setTimeout(() => {
      update(); // refresh Lenis metrics so the offset is accurate
      scrollTo(hash, { offset: 0 });
    }, 150);
    return () => window.clearTimeout(t);
  }, [isReady, scrollTo, update]);

  // ── Refresh LS when children change ─────────────────────────────
  useEffect(() => {
    if (isReady) {
      // Use rAF to let React commit DOM before recalculating
      const raf = requestAnimationFrame(() => update());
      return () => cancelAnimationFrame(raf);
    }
  }, [children, isReady, update]);

  return (
    <LocoContext.Provider
      value={{ locoScroll: locoRef.current, update, scrollTo, isReady }}
    >
      <div ref={containerRef} data-scroll-container className={className}>
        {children}
      </div>
    </LocoContext.Provider>
  );
}
