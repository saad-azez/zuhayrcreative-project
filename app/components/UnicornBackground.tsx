"use client";

import UnicornScene from "unicornstudio-react";

export default function UnicornBackground() {
  return (
    <div
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <UnicornScene
        projectId="Jfd9X7kR2X11pSNFto2p"
        width="100%"
        height="100%"
        scale={1}
        dpi={1.5}
        sdkUrl="https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.1.12/dist/unicornStudio.umd.js"
      />
    </div>
  );
}
