"use client";

import UnicornScene from "unicornstudio-react";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";
import { useDeviceDetect } from "@/app/animations/hooks/useDeviceDetect";

export default function FooterScene() {
  const { isTouch } = useDeviceDetect();
  const dpi = isTouch ? 1 : 1.5;

  return (
    <section
      aria-hidden
      style={{
        position: "relative",
        width: "100%",
        height: "100svh",
        overflow: "hidden",
        // Dark base so the masked-in top fades from the footer's dark tone
        // (not the maroon page background) — keeps the seam a clean dark blend.
        background: "var(--background)",
      }}
    >
      {/* Scene faded IN from the top: the top ~30% is masked transparent so the
          dark base shows through and cross-fades into the scene, blending into
          the dark footer above instead of meeting it at a hard line — mirrors
          the footer's own top cross-fade. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, #000 30%, #000 100%)",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, #000 30%, #000 100%)",
        }}
      >
        <UnicornScene
          projectId="H3S81zUuwDrduzdsOMSr"
          width="100%"
          height="100%"
          scale={1}
          dpi={dpi}
          lazyLoad={false}
          sdkUrl={UNICORN_SDK_URL}
        />
      </div>
    </section>
  );
}
