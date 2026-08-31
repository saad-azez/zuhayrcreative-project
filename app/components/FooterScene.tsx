"use client";

import { useRef } from "react";
import UnicornScene from "unicornstudio-react";
import { UNICORN_SDK_URL } from "@/app/lib/unicorn";
import {
  useUnicornCanvasFade,
  useUnicornGuard,
  useUnicornPerf,
} from "@/app/lib/unicornPerf";

export default function FooterScene() {
  const ref = useRef<HTMLDivElement>(null);
  // Device-tiered render settings; paused while scrolled offscreen (this
  // section lives at the very bottom of the page) and self-healing if the
  // browser evicts its WebGL context.
  const perf = useUnicornPerf();
  const { sceneKey, paused } = useUnicornGuard(ref, true);

  // Fade the WebGL <canvas> in the moment it mounts — same soft cross-fade
  // as the page-wide UnicornBackground and the hero's HeroBackground, so the
  // scene blends up from the dark base instead of popping in.
  useUnicornCanvasFade(ref);

  return (
    <section
      aria-hidden
      style={{
        position: "relative",
        width: "100%",
        height: "100svh",
        overflow: "hidden",
        // Solid BLACK base: the masked-out top reveals black (never the
        // maroon page background), matching the footer's fade-to-black just
        // above so the seam dips through a continuous black valley.
        background: "#000",
      }}
    >
      {/* Scene faded IN from the top: only the top ~12% is masked transparent
          so the black base shows through and the scene dissolves in quickly,
          mirroring the footer scene's fade-to-black above. */}
      <div
        ref={ref}
        style={{
          position: "absolute",
          inset: 0,
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, #000 12%, #000 100%)",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, #000 12%, #000 100%)",
        }}
      >
        <UnicornScene
          key={sceneKey}
          projectId="FadLJOXloN1zCORxhKb0"
          width="100%"
          height="100%"
          scale={perf.scale}
          dpi={perf.dpi}
          fps={perf.fps}
          paused={paused}
          lazyLoad
          sdkUrl={UNICORN_SDK_URL}
        />
      </div>

      {/* Tint continuation: the footer's content panel darkens its bottom to
          ~70% black for text contrast; ending that tint exactly at the section
          border would itself read as a line. Carry it over the seam and let
          it dissolve on the way down. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 5%)",
        }}
      />
    </section>
  );
}
