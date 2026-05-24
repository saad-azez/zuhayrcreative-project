"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    UnicornStudio: {
      isInitialized: boolean;
      init: () => void;
      destroy?: () => void;
    };
  }
}

export default function UnicornBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    // Avoid double-init in StrictMode
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;

    const u = window.UnicornStudio;
    if (u && u.init) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => u.init());
      } else {
        u.init();
      }
    } else {
      window.UnicornStudio = {
        isInitialized: false,
      } as Window["UnicornStudio"];
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.1.12/dist/unicornStudio.umd.js";
      script.onload = () => {
        const { UnicornStudio } = window;
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", () =>
            UnicornStudio.init(),
          );
        } else {
          UnicornStudio.init();
        }
      };
      (document.head || document.body).appendChild(script);
    }

    return () => {
      // Cleanup on unmount (e.g., during HMR)
      try {
        window.UnicornStudio?.destroy?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <div
        data-us-project="lKyioS50Pa36WwMy98ZW"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
