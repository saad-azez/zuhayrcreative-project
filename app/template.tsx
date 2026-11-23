"use client";

import { useRef, useState, useCallback, useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import LoadingScreen from "./components/LoadingScreen";
import IntroSignal from "./components/IntroSignal";
import { readHeroVariant } from "./lib/heroVariant";
import Navbar from "./components/Navbar";
import GlobalCursor from "./components/GlobalCursor";
import ScrollBlur from "./components/ScrollBlur";
import LocomotiveScrollProvider from "./components/LocomotiveScrollProvider";
import IdleScreen from "./components/IdleScreen";
import FluidCursor from "./components/FluidCursor";
import CornerGlassDock from "./components/CornerGlassDock";
import SiteFooter from "./components/SiteFooter";
import GlitchReveal from "./components/GlitchReveal";
import DebugPanelGate from "./components/DebugPanelGate";
import AtelierWindow from "./components/AtelierWindow";

// The model draft (?hero=model) has its own intro; every other address keeps
// the original. Read after hydration (the server cannot see the address).
const noSubscribe = () => () => {};
const isModelIntro = () => readHeroVariant() === "model";
const serverIntro = () => false;

// Whether the atelier is up full screen (AtelierWindow puts body.atelier-full).
const onBodyClass = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
};
const isAtelierFull = () => document.body.classList.contains("atelier-full");

export default function Template({ children }: { children: React.ReactNode }) {
  const modelIntro = useSyncExternalStore(noSubscribe, isModelIntro, serverIntro);
  // While the atelier covers the screen the page is taken out of rendering
  // (display: none), not taken down: iOS drops its layers, the scenes that
  // follow the scroll let go of theirs (useSceneLease), and the rest stays
  // built, so closing the atelier puts it back where it was at once. Merely
  // invisible, it kept all of it and the next opening went over iOS's limit
  // (23 Nov). Taking it down and building it again
  // (the way until 23 Nov) left the client's iPhone 12 on a blank screen for
  // seconds after Close. The memory that made that necessary was the atelier
  // keeping what it made after closing; it now runs in a frame that is
  // removed whole (AtelierWindow), and the page and the open atelier fit.
  const atelierFull = useSyncExternalStore(onBodyClass, isAtelierFull, serverIntro);
  const [coverDrawn, setCoverDrawn] = useState(false);
  const pageHidden = atelierFull && coverDrawn;
  const savedY = useRef(0);
  useEffect(() => {
    if (!atelierFull) return;
    savedY.current = window.scrollY;
    // A frame for the atelier's cover to be drawn first.
    const id = requestAnimationFrame(() => setCoverDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [atelierFull]);
  const wasHidden = useRef(false);
  // Layout effect: the place is put back before the page is painted again,
  // so it never shows at the top for a frame.
  useLayoutEffect(() => {
    if (pageHidden) {
      wasHidden.current = true;
      return;
    }
    if (!wasHidden.current) return;
    wasHidden.current = false;
    const w = window as Window & { __pageReturnY?: number };
    const y = w.__pageReturnY ?? savedY.current;
    delete w.__pageReturnY;
    window.scrollTo(0, y);
    window.dispatchEvent(new CustomEvent("app:scroll-set", { detail: { y } }));
    window.dispatchEvent(new Event("resize"));
    setCoverDrawn(false);
    // The page is showing again: the atelier may fade (AtelierWindow).
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("app:page-back")));
    return () => cancelAnimationFrame(id);
  }, [pageHidden]);
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
      (window as Window & { __appUncovered?: boolean }).__appUncovered = false;
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

  // The curtain has started to lift: put the page behind it NOW. It peels back
  // to show what is underneath, so what is underneath has to already be there.
  const handleReveal = useCallback(() => {
    setLocoEnabled(true);
    reveal();
  }, [reveal]);

  // The curtain is off screen — nothing left to keep mounted.
  const handleComplete = useCallback(() => {
    setShouldShowLoader(false);
    if (loadingRef.current) {
      loadingRef.current.style.display = "none";
    }
    // Separate from `app:reveal` on purpose. That one fires as the curtain
    // STARTS lifting, because the page has to be there for it to peel off. This
    // one fires once it is gone, for entrances that have to be watched from
    // their first frame rather than played out behind it — the hero headline.
    (window as Window & { __appUncovered?: boolean }).__appUncovered = true;
    window.dispatchEvent(new Event("app:uncovered"));
  }, []);

  return (
    <>
      <GlobalCursor />
    
      {/* Fluid water cursor: ripple wake under the pointer, splash on click,
          and the big brand splash on `app:splash`. */}
      <FluidCursor />
    
      {/* Idle overlay — sits above everything (z-9999), activates after 15s */}
      <IdleScreen />
    
      <div ref={loadingRef}>
        {shouldShowLoader && (
          modelIntro ? (
            <IntroSignal onReveal={handleReveal} onComplete={handleComplete} />
          ) : (
            <LoadingScreen
              onReveal={handleReveal}
              onComplete={handleComplete}
            />
          )
        )}
      </div>
      <Navbar ref={navbarRef} />
    
      <ScrollBlur />
    
      {/* Bottom-right liquid-glass + dock — appears occasionally, ripples,
          and pops open into quick actions. Outside the Locomotive wrapper
          so its position:fixed isn't broken by the scroller's transform. */}
      <CornerGlassDock />

      {/* The atelier window (model draft): idle, menu and exit-intent ways in. */}
      {modelIntro && <AtelierWindow />}

      {/* The words and numbers of every page arrive pixelated, as the
          paragraph section's do (GlitchReveal). */}
      <GlitchReveal />

      {/* The performance debug panel: only with ?debug=1, and nothing at all
          otherwise (see lib/perfDebug.ts). */}
      <DebugPanelGate />
    
      <LocomotiveScrollProvider enabled={locoEnabled}>
        <div style={{ display: pageHidden ? "none" : "contents" }}>
        {children}
        {/* Breathing room above the footer on every page (landing, career,
            club, contact) so the last section isn't cramped against it. */}
        <div aria-hidden className="w-full h-[10vh] md:h-[14vh]" />
        {/* One shared footer for every page — edit ContactFooter / FooterScene
            and it updates site-wide. */}
        <SiteFooter />
        </div>
      
      </LocomotiveScrollProvider>
    </>
  );
}
