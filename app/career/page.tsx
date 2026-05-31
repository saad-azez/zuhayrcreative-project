"use client";

import dynamic from "next/dynamic";

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

      <main className="min-h-screen flex items-center justify-center">
        <h1
          className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-foreground"
          aria-label="Career"
        >
          Career
        </h1>
      </main>
    </>
  );
}
