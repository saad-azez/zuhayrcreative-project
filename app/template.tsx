"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Navbar from "./components/Navbar";
import DarkVeil from "./components/DarkVeil";
import GlobalCursor from "./components/GlobalCursor";
import LocomotiveScrollProvider from "./components/LocomotiveScrollProvider";

// Global variable to persist between page navigations (client-side)
let hasLoadedOnce = false;

export default function Template({ children }: { children: React.ReactNode }) {
  const loadingRef = useRef<HTMLDivElement>(null);
  const navbarRef = useRef<{ triggerEntrance: () => void }>(null);
  
  // If we have loaded once, skip the loading screen
  const [shouldShowLoader, setShouldShowLoader] = useState(!hasLoadedOnce);
  const [locoEnabled, setLocoEnabled] = useState(hasLoadedOnce);

  // Trigger entrance immediately if skipped
  useEffect(() => {
    if (!shouldShowLoader) {
      navbarRef.current?.triggerEntrance();
    }
  }, [shouldShowLoader]);

  const handleNearComplete = useCallback(() => {
    navbarRef.current?.triggerEntrance();
  }, []);

  const handleComplete = useCallback(() => {
    hasLoadedOnce = true;
    setShouldShowLoader(false);
    if (loadingRef.current) {
      loadingRef.current.style.display = "none";
    }
    setLocoEnabled(true);
  }, []);

  return (
    <>
      {/* Water ripple effect on cursor — shared across all pages */}
      <DarkVeil
        overlay
        variant="default"
        speed={0.44}
        nnColorFront="#00000000"
        nnColorMid="#00000000"
        nnColorBack="#00000000"
      />
      <GlobalCursor />
      <div ref={loadingRef}>
        {shouldShowLoader && (
          <LoadingScreen
            onComplete={handleComplete}
            onNearComplete={handleNearComplete}
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
