"use client";

import { useRef } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Navbar from "./components/Navbar";
import Silk from "./components/Silk";

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
      <Silk
        color="#36090e"
        speed={3}
        scale={1.5}
        noiseIntensity={1.2}
        rotation={0.2}
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
