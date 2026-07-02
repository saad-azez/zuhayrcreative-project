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
    </section>
  );
}
