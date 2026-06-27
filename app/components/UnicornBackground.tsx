"use client";

import UnicornScene from "unicornstudio-react";

/**
 * Fixed, full-viewport Unicorn Studio WebGL background, shared across pages.
 * The solid backdrop ensures nothing shows through while the scene loads, and
 * it sits behind page content (z-index: -10) so every transparent section
 * shows it through.
 */
export default function UnicornBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: -10,
        overflow: "hidden",
        background: "#0a0a0a",
      }}
    >
      <UnicornScene
        projectId="nHxm08nl2UefH5hUAMVJ"
        width="100%"
        height="100%"
        scale={1}
        dpi={1.5}
        sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.6/dist/unicornStudio.umd.js"
        className="h-full w-full"
      />
    </div>
  );
}
