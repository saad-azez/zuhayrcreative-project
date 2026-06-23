"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Navbar from "./components/Navbar";
import LocomotiveScrollProvider from "./components/LocomotiveScrollProvider";

// Global variable to persist between page navigations (client-side)
let hasLoadedOnce = false;

export default function Template({ children }: { children: React.ReactNode }) {
  const loadingRef = useRef<HTMLDivElement>(null);
  const navbarRef = useRef<{ triggerEntrance: () => void }>(null);

  // SSR-safe defaults: always show loader initially so server and client
  // initial render agree. After mount we correct based on hasLoadedOnce.
  const [shouldShowLoader, setShouldShowLoader] = useState(true);
  const [locoEnabled, setLocoEnabled] = useState(false);

  // After hydration, skip the loader if we've already been through it.
  useEffect(() => {
    if (hasLoadedOnce) {
      setShouldShowLoader(false);
      setLocoEnabled(true);
    }
  }, []);

  // Trigger entrance immediately if skipped
  useEffect(() => {
    if (!shouldShowLoader) {
      navbarRef.current?.triggerEntrance();
    }
  }, [shouldShowLoader]);

  const handleComplete = useCallback(() => {
    hasLoadedOnce = true;
    setShouldShowLoader(false);
    if (loadingRef.current) {
      loadingRef.current.style.display = "none";
    }
    setLocoEnabled(true);
    // Trigger navbar entrance AFTER loading screen is fully gone
    navbarRef.current?.triggerEntrance();
  }, []);

  return (
    <>
      <div ref={loadingRef}>
        {shouldShowLoader && (
          <LoadingScreen
            onComplete={handleComplete}
          />
        )}
      </div>
      <Navbar ref={navbarRef} />
      <LocomotiveScrollProvider enabled={locoEnabled}>
        {children}
      </LocomotiveScrollProvider>
    </>
  );
}
