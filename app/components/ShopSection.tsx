"use client";

import { useEffect, useRef } from "react";
import {
  SHOP_ASSETS,
  ShopPoster,
  loadShop,
  shopGoesLive,
} from "./shopEmbed";

/**
 * The 3D shop ("Paint to Pixel", the client's atelier window) as a section of
 * its own on the home page, between the work section and the impact figures.
 *
 * NOT MOUNTED at the moment: the client asked for the window back in the hero
 * on 13 Oct (HeroShop), and the two placements are the same scene, so it is
 * one or the other. This one is kept, whole, behind SHOW_SHOP_SECTION in
 * app/page.tsx: the client has not settled where the window lives, and down
 * here it costs a visitor nothing until they are on the way to it.
 *
 * This file is only the placement; shopEmbed.tsx has what the scene is, where
 * it is loaded from, and who gets it live.
 *
 * The window is a closed box — its own walls, and black round the frame — so
 * the section is opaque, and says so (`data-bg-cover`, lib/backgroundCover.ts):
 * the page-wide background holds its last frame while this fills the screen.
 *
 * Nothing is asked for until the reader is within two and a half screens of
 * the section and the loader's curtain is off. Until the scene has drawn its
 * first frames the section shows the scene's poster, which is the frame the
 * live window opens on.
 */

/**
 * How far ahead of the viewport the window is sent for and starts to build
 * itself: two and a half screens, which on this page is about the top of the
 * work section. It needs the time. After its textures are in it compiles its
 * shaders in the background and then walks itself once through its loop,
 * unseen, so that nothing is left to stop the page for when the reader gets
 * to it (shop/README.md, "Start-up").
 */
const APPROACH = "250% 0px 250% 0px";

export default function ShopSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const host = hostRef.current;
    if (!section || !host || !shopGoesLive()) return;

    let cancelled = false;
    let started = false;
    let view: { destroy(): void } | null = null;
    // Both have to be true: the reader is on the way here, and the curtain
    // is off (a deep link can open the page right on top of this section).
    let near = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          near = true;
          start();
        }
      },
      { rootMargin: APPROACH },
    );
    function start() {
      const uncovered = (window as Window & { __appUncovered?: boolean })
        .__appUncovered;
      if (started || cancelled || !near || !uncovered) return;
      started = true;
      io.disconnect();
      loadShop()
        .then((mod) => {
          if (cancelled) return;
          // The scene brings its own copy of the poster and fades its canvas
          // in over it, so the one below never has to be taken away.
          view = mod.mountShop(host!, {
            assetBase: SHOP_ASSETS,
            approach: APPROACH,
            yieldToScroll: true,
          });
        })
        // Left on the poster: a still window is the right thing to show for
        // a scene that could not be fetched.
        .catch(() => undefined);
    }
    io.observe(section);
    window.addEventListener("app:uncovered", start);
    return () => {
      cancelled = true;
      io.disconnect();
      window.removeEventListener("app:uncovered", start);
      view?.destroy();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="The atelier window"
      data-shop-section
      data-shop
      // Opaque over its whole box: the page background behind it is paused
      // while this fills the screen (backgroundCover.ts).
      data-bg-cover
      className="relative h-svh w-full overflow-hidden"
      style={{ background: "#0a0a0a" }}
    >
      <ShopPoster />
      <div ref={hostRef} className="absolute inset-0" />
    </section>
  );
}
