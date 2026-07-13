import type { Metadata } from "next";
import UnicornBackground from "../components/UnicornBackground";
import FlyingPosters from "../components/FlyingPosters";

export const metadata: Metadata = {
  title: "The Club",
  description:
    "The Club — a living archive of Zuhayr Creative's world. Placeholder while the section is rebuilt.",
};

// ⚠️ PLACEHOLDER posters — swap for the real club images when provided.
const POSTERS = Array.from(
  { length: 8 },
  (_, i) => `https://picsum.photos/seed/zc-club-poster-${i + 1}/600/800`,
);

export default function ClubPage() {
  return (
    <>
      {/* Shared Unicorn Studio WebGL background — same fixed scene as the rest
          of the site; the FlyingPosters canvas is transparent over it. */}
      <UnicornBackground />
      {/* FlyingPosters lives in a full-height section (not the whole page), so
          the shared footer below stays reachable by scroll. The posters scrub
          on wheel via their own window listener; the page still scrolls on. */}
      <main className="relative w-full max-w-full overflow-x-hidden">
        <section className="relative h-dvh w-full overflow-hidden">
          <h1 className="sr-only">The Club — Zuhayr Creative</h1>
          <FlyingPosters
            items={POSTERS}
            planeWidth={320}
            planeHeight={420}
            distortion={3}
            scrollEase={0.03}
            cameraFov={45}
            cameraZ={20}
          />
        </section>
      </main>
    </>
  );
}
