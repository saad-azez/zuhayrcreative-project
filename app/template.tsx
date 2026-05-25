"use client";

import { useRef, useState, useCallback } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Navbar from "./components/Navbar";
import DarkVeil from "./components/DarkVeil";
import LocomotiveScrollProvider from "./components/LocomotiveScrollProvider";

export default function Template({ children }: { children: React.ReactNode }) {
  const loadingRef = useRef<HTMLDivElement>(null);
  const navbarRef = useRef<{ triggerEntrance: () => void }>(null);
  const [locoEnabled, setLocoEnabled] = useState(false);

  const handleNearComplete = useCallback(() => {
    navbarRef.current?.triggerEntrance();
  }, []);

  const handleComplete = useCallback(() => {
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
      <div ref={loadingRef}>
        <LoadingScreen
          onComplete={handleComplete}
          onNearComplete={handleNearComplete}
        />
      </div>
      <Navbar ref={navbarRef} />
      <LocomotiveScrollProvider enabled={locoEnabled}>
        {children}
      </LocomotiveScrollProvider>
    </>
  );
}
