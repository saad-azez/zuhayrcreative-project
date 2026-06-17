"use client";

import dynamic from "next/dynamic";
import ContactFooter from "../components/ContactFooter";
import StackedPanels from "../components/StackedPanels";

const Beams = dynamic(() => import("../components/Beams/Beams"), {
  ssr: false,
});

export default function CareerPage() {
  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: -10,
          overflow: "hidden",
        }}
      >
        <Beams
          beamWidth={3}
          beamHeight={24}
          beamNumber={19}
          lightColor="#e10a7c"
          speed={2.2}
          noiseIntensity={0}
          scale={0.2}
          rotation={35}
        />
      </div>

      <main className="relative w-full max-w-full min-h-screen overflow-x-hidden">
        <div className="w-full h-screen">
          <StackedPanels />
        </div>
        <ContactFooter />
      </main>
    </>
  );
}
