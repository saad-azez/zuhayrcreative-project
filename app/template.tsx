"use client";

import { useRef } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Navbar from "./components/Navbar";
import DarkVeil from "./components/DarkVeil";

export default function Template({ children }: { children: React.ReactNode }) {
  const loadingRef = useRef<HTMLDivElement>(null);
  const navbarRef = useRef<{ triggerEntrance: () => void }>(null);

  const handleNearComplete = () => {
    navbarRef.current?.triggerEntrance();
  };

  const handleComplete = () => {
    if (loadingRef.current) {
      loadingRef.current.style.display = "none";
    }
  };

  return (
    <>
      <DarkVeil
        speed={2.5}
        hueShift={0}
        noiseIntensity={0}
        warpAmount={0.3}
      />
      <div ref={loadingRef}>
        <LoadingScreen
          onComplete={handleComplete}
          onNearComplete={handleNearComplete}
        />
      </div>
      <Navbar ref={navbarRef} />
      {children}
    </>
  );
}
