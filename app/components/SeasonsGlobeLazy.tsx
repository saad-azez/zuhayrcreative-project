"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type Ref } from "react";
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
 * A wide approach margin, as a share of the viewport — the fallback for a
 * reader who arrives before the idle build below has had its chance (a
 * deep link, a nav jump, a flick straight to the footer on a page that has
 * not stopped moving since it loaded).
 */
const APPROACH_MARGIN = "300% 0px 300% 0px";

export default function SeasonsGlobeLazy() {
  const shellRef = useRef<HTMLElement>(null);
  const near = useNearViewport(shellRef, APPROACH_MARGIN);
  /**
   * Built already, because the browser had nothing better to do.
   *
   * Approach was the only trigger, and it could not win. Mounting this
   * section is React committing its markup, react-three-fiber measuring the
   * canvas, then 252 tiles of scene — and it was being asked to do all of
   * that at the one moment the page is at its busiest, with the reader
   * scrolling and every section above still animating. Measured on a fast
   * flick at 6x CPU throttle: 2.3s, of which 1.3s was React committing the
   * markup and 38% of the whole wait was the main thread being held by other
   * work. Widening the margin did not help either, because the margin buys
   * scroll distance and what was missing was QUIET.
   *
   * So the globe is built in the first quiet moment instead — a second idle
   * callback after the one that warms its code and pictures, so the order is
   * always fetch, then build, each when the browser is doing nothing. By the
   * time the reader scrolls anywhere near it, it is finished and sitting
   * there. It still runs no frames until it is in view (its own 10% gate in
   * SeasonsGlobe), so an unseen globe costs nothing per frame.
   *
   * The one thing this spends that approach-only did not is a WebGL context
   * for every visitor, including those who never scroll down. It is taken
   * after the boot burst is over rather than during it, which is what the
   * context budget cares about (see the notes on the landing page's context
   * count), and it is the same context the section was always going to take.
   */
  const [built, setBuilt] = useState(false);

  useEffect(() => {
    globeMark("shell: on the page", "warming, then building, while idle");
    // The CODE was always warmed here. The PICTURES were not, and they are
    // what the reader used to wait on: three.js asks for them only when the
    // scene mounts, and the scene shows nothing until every one has landed.
    return prefetchWhenIdle(async () => {
      warmSeasonsTextures();
      globeMark("textures: warming during idle");
      await loadGlobe();
      // Code and pictures are in. Take the next quiet slot to actually build
      // it, rather than doing both in one long task.
      // A SHORT timeout on purpose. requestIdleCallback waits for a quiet
      // slot, and a page whose sections are all still animating may not offer
      // one for as long as the reader keeps scrolling — measured, a 6000ms
      // timeout let the build land 15s in, during the very flick it was meant
      // to get ahead of. 700ms means it happens almost at once, ideally in a
      // gap and otherwise anyway; either way it is long before the reader can
      // reach the last section of the page.
      const schedule = (cb: () => void) =>
        typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback(cb, { timeout: 700 })
          : window.setTimeout(cb, 300);
      schedule(() => {
        globeMark("idle: building it now", "the reader is not here yet");
        setBuilt(true);
      });
    });
  }, []);

  // The moment the shell is swapped for the real section. Everything after
  // this is the wait the reader would see if they arrived now, so the trace
  // measures from here (see globeSummary).
  useEffect(() => {
    if (near || built) {
      globeMark("approach: mounting", built ? "idle build" : "reader came near");
    }
  }, [near, built]);

  return near || built ? <SeasonsGlobe /> : <SeasonsShell ref={shellRef} />;
}
