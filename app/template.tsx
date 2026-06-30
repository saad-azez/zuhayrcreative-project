"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Navbar from "./components/Navbar";
import GlobalCursor from "./components/GlobalCursor";
import ScrollBlur from "./components/ScrollBlur";
import LocomotiveScrollProvider from "./components/LocomotiveScrollProvider";

export default function Template({ children }: { children: React.ReactNode }) {
  const loadingRef = useRef<HTMLDivElement>(null);
  const navbarRef = useRef<{ triggerEntrance: () => void }>(null);

  // The loader plays on every navigation: this template re-mounts for each
  // route change, so starting with `shouldShowLoader = true` means the loading
  // screen always shows first when the page is redirected to a new page. It's
  // also SSR-safe — server and client initial render agree on `true`.
  const [shouldShowLoader, setShouldShowLoader] = useState(true);
  const [locoEnabled, setLocoEnabled] = useState(false);

  // The loader now plays on every navigation, so the hero must wait for THIS
  // loader's hand-off rather than the stale "already revealed" flag a previous
  // visit left behind. Clear it synchronously in render — the template renders
  // before its page children, so the hero reads `false` and stays hidden until
  // `app:reveal` fires at the end of the loader.
  const didResetReveal = useRef(false);
  if (!didResetReveal.current) {
    didResetReveal.current = true;
    if (typeof window !== "undefined") {
      (window as Window & { __appRevealed?: boolean }).__appRevealed = false;
    }
  }

  // On a fresh load/reload, start at the top (hero) — pairs with the
  // `scrollRestoration = manual` set in the document head. Skip this when the
  // URL carries a section hash (e.g. arriving at `/#services` from another
  // page): the LocomotiveScrollProvider honours that hash once it's ready.
  useEffect(() => {
    if (window.location.hash) return;
    window.scrollTo(0, 0);
  }, []);

  // Reveal the UI: navbar entrance + broadcast so page content (hero text)
  // can play its load animation at the same moment.
  const reveal = useCallback(() => {
    (window as Window & { __appRevealed?: boolean }).__appRevealed = true;
    navbarRef.current?.triggerEntrance();
    window.dispatchEvent(new Event("app:reveal"));
  }, []);

  const handleComplete = useCallback(() => {
    setLocoEnabled(true);
    // Reveal the hero FIRST, so its logo paints at rest exactly where the
    // loader's logo just flew to, then remove the loader a beat later — an
    // invisible swap between two identical, aligned logos.
    reveal();
    window.setTimeout(() => {
      setShouldShowLoader(false);
      if (loadingRef.current) {
        loadingRef.current.style.display = "none";
      }
    }, 250);
  }, [reveal]);

  return (
    <>
      <GlobalCursor />
      <div ref={loadingRef}>
        {shouldShowLoader && (
          <LoadingScreen
            onComplete={handleComplete}
          />
        )}
      </div>
      <Navbar ref={navbarRef} />
      <ScrollBlur />
      <LocomotiveScrollProvider enabled={locoEnabled}>
        {children}
      </LocomotiveScrollProvider>
    </>
  );
}
