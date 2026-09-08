"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, type Ref } from "react";
import {
  prefetchWhenIdle,
  useNearViewport,
} from "@/app/animations/hooks/useNearViewport";

/**
 * The Seasons globe, loaded on approach.
 *
 * The globe is the last section on the page and the only thing on it that
 * needs three.js and react-three-fiber — about a fifth of the landing page's
 * JavaScript, and a WebGL context, 252 textured tiles and a scene graph built
 * at mount. All of it used to ship and initialise before the hero could show,
 * for a section three screens below the fold that many readers never reach.
 *
 * So the page renders this SHELL instead: a section of exactly the globe's
 * size, carrying the #seasons anchor the navbar points at and the heading
 * assistive tech reads. The globe's code is fetched during idle time once the
 * curtain has lifted, and the real section takes the shell's place when the
 * reader is within a viewport and a half of it (useNearViewport). The two are
 * the same height by construction — `h-dvh` on both — so the swap moves
 * nothing, and every scroll trigger above it keeps its numbers.
 *
 * Once mounted it stays mounted. The globe already stops its own render loop
 * when it is off screen, which is where its cost was; tearing it down on the
 * way back up would only buy a stutter on the way back down.
 */
const loadGlobe = () => import("./SeasonsGlobe");

const SeasonsGlobe = dynamic(loadGlobe, {
  ssr: false,
  loading: () => <SeasonsShell />,
});

function SeasonsShell({ ref }: { ref?: Ref<HTMLElement> }) {
  return (
    <section
      ref={ref}
      id="seasons"
      aria-label="Seasons"
      className="relative h-dvh w-full overflow-hidden"
    >
      <h2 className="sr-only">Seasons — a living archive</h2>
    </section>
  );
}

export default function SeasonsGlobeLazy() {
  const shellRef = useRef<HTMLElement>(null);
  const near = useNearViewport(shellRef);

  useEffect(() => prefetchWhenIdle(loadGlobe), []);

  return near ? <SeasonsGlobe /> : <SeasonsShell ref={shellRef} />;
}
