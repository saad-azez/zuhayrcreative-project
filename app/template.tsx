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
    // Enable Locomotive Scroll only AFTER loading finishes
    // so it doesn't compete with the loading animation
    setLocoEnabled(true);
  }, []);

  return (
    <>
      <DarkVeil />
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
