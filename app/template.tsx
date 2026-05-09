"use client";

import { useState } from "react";
import LoadingScreen from "./components/LoadingScreen";

export default function Template({ children }: { children: React.ReactNode }) {
  const [exited, setExited] = useState(false);

  const handleComplete = () => {
    setExited(true);
  };

  return (
    <>
      {!exited && <LoadingScreen onComplete={handleComplete} />}
      {children}
    </>
  );
}
