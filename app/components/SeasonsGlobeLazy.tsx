"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, type Ref } from "react";
import {
  prefetchWhenIdle,
  useNearViewport,
} from "@/app/animations/hooks/useNearViewport";
import { globeMark } from "./globeTrace";
import { warmSeasonsTextures } from "./seasonsImages";

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
/* Called twice on purpose: once by the idle warm-up, once by dynamic() when
   the section mounts. The second is a module-cache hit and costs nothing —
   labelled so it does not read as the code being fetched all over again. */
let chunkAsked = false;
const loadGlobe = () => {
  const first = !chunkAsked;
  chunkAsked = true;
  globeMark(first ? "chunk: requested" : "chunk: already warm");
  return import("./SeasonsGlobe").then((m) => {
    if (first) globeMark("chunk: ready");
    return m;
  });
};

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

/**
 * How early to start building the globe, as a share of the viewport.
 *
 * The default approach margin is 150%, which buys a second or two of
 * scrolling — and mounting this section costs more than that: React commits
 * its markup, react-three-fiber measures the canvas and builds the scene, and
 * only then can anything be drawn. Measured at 6x CPU throttle that is about
 * a second and a half, and on a slow machine the client measured three and a
 * half. Arriving inside that window is exactly the "I have to wait a few
 * seconds" they reported: the work was never slow to START, it was started
 * too late to FINISH.
 *
 * 300% roughly doubles the runway and costs nothing to look at — the shell is
 * the same height, so nothing moves, and the globe still runs no frames until
 * it is genuinely in view (its own 10% gate inside SeasonsGlobe). The WebGL
 * context it takes is one it was always going to take; only the moment moves.
 */
const APPROACH_MARGIN = "300% 0px 300% 0px";

export default function SeasonsGlobeLazy() {
  const shellRef = useRef<HTMLElement>(null);
  const near = useNearViewport(shellRef, APPROACH_MARGIN);

  useEffect(() => {
    globeMark("shell: on the page", "waiting for the reader to come near");
    // The CODE was always warmed here. The PICTURES were not, and they are
    // what the reader was waiting on: three.js asks for them only when the
    // scene mounts, and the scene shows nothing until every one has landed.
    // Warmed together, the mount finds them in cache.
    return prefetchWhenIdle(async () => {
      warmSeasonsTextures();
      globeMark("textures: warming during idle");
      await loadGlobe();
    });
  }, []);

  // The moment the shell is swapped for the real section. Everything after
  // this is the wait the reader actually sees, so the trace measures from
  // here (see globeSummary).
  useEffect(() => {
    if (near) globeMark("approach: mounting", "within 1.5 screens");
  }, [near]);

  return near ? <SeasonsGlobe /> : <SeasonsShell ref={shellRef} />;
}
