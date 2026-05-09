"use client";

import { useRef } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Navbar from "./components/Navbar";

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
