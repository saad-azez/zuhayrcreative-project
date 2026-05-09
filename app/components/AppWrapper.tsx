"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import LoadingScreen from "./LoadingScreen";

export default function AppWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [exited, setExited] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Called when the slide-up exit animation completes
  const handleComplete = () => {
    setExited(true);
    if (!contentRef.current) return;
    gsap.fromTo(
      contentRef.current,
      { opacity: 0, scale: 0.98 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.8,
        ease: "power3.out",
        clearProps: "scale",
      },
    );
  };

  return (
    <>
      {!exited && <LoadingScreen onComplete={handleComplete} />}
      <div ref={contentRef} style={{ opacity: 0 }}>
        {children}
      </div>
    </>
  );
}
