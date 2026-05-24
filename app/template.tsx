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
      <DarkVeil
        variant="aurora"
        auroraColorStops={["#470015", "#DC143C", "#DE3163"]}
        auroraBlend={0.5}
        auroraAmplitude={1.0}
        speed={1.4}
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
