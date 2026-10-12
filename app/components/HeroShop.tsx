"use client";

import { useEffect, useRef } from "react";
import {
  SHOP_ASSETS,
  ShopPoster,
  loadShop,
  shopGoesLive,
} from "./shopEmbed";

/**
 * The 3D shop ("Paint to Pixel", the client's atelier window) in the hero: a
 * layer that fills it, over the page's background and under the headline.
 *
 * Its second time here. It was first put in the hero on 12 Oct (client: "place
 * it in the hero on top of the unicorn background and test how it looks"),
 * taken out the same day because it made the top of the page stall ("the
 * website is feeling very laggy … don't add it to the hero section"), and
 * asked back on 13 Oct once the stall had been found and removed: the scene
 * used to stop the page for 12 to 14 seconds building its shaders the first
 * time it drew, and it now builds them in the background and rehearses itself
 * behind its poster first (shop/README.md, "Start-up"). It is now one of the
 * three hero backgrounds being compared (lib/heroVariant.ts, "shop"). The
 * other placement, a section of its own further down, is ShopSection;
 * app/page.tsx has its switch. One or the other, never both: they are the
 * same scene.
 *
 * This file is only the placement; shopEmbed.tsx has what the scene is, where
 * it is loaded from, and who gets it live.
 *
 * The window is a closed box — its own walls, and black round the frame — so
 * it COVERS what is behind it rather than floating on it. Two things follow,
 * both about not drawing what cannot be seen:
 *  - the hero's own background scene is not mounted while this is on (see
 *    HeroBanner);
 *  - the page-wide background is told it is covered (`data-bg-cover`,
 *    lib/backgroundCover.ts) and holds its last frame until the hero has
 *    started to leave the screen.
 *
 * Timing. Until the loader's curtain is off, only the poster is shown, and
 * nothing of the scene is fetched. Then the scene is sent for at once, but
 * mounted a beat later (MOUNT_AFTER_MS): the headline makes its entrance in
 * that beat, and the scene's first work, though it is in short slices now,
 * is still work on the same thread. The poster is the frame the live window
 * opens on, so the hand-over is a cross-fade between two of the same picture.
 */
const MOUNT_AFTER_MS = 1200;

export default function HeroShop() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !shopGoesLive()) return;

    let cancelled = false;
    let timer = 0;
    let view: { destroy(): void } | null = null;
    const start = () => {
      const loading = loadShop();
      // Left on the poster if it cannot be fetched: a still window is the
      // right thing to show for a scene that is not there.
      loading.catch(() => undefined);
      timer = window.setTimeout(() => {
        loading
          .then((mod) => {
            if (cancelled) return;
            // The scene brings its own copy of the poster and fades its
            // canvas in over it, so the one below never has to be taken away.
            view = mod.mountShop(host, {
              assetBase: SHOP_ASSETS,
              // The hero's own motion and the page's scroll come first.
              yieldToScroll: true,
            });
          })
          .catch(() => undefined);
      }, MOUNT_AFTER_MS);
    };

    // The template clears this flag for every page load before the hero
    // mounts, so it is only ever already set on a re-mount under a lifted
    // curtain.
    if ((window as Window & { __appUncovered?: boolean }).__appUncovered) {
      start();
    } else {
      window.addEventListener("app:uncovered", start, { once: true });
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("app:uncovered", start);
      view?.destroy();
    };
  }, []);

  return (
    <div
      data-hero-shop
      data-shop
      // Opaque over its whole box: the page background behind it is paused
      // while this fills the screen (backgroundCover.ts).
      data-bg-cover
      className="absolute inset-0 overflow-hidden"
      // Over the page (and under the hero's headline, 10).
      style={{ zIndex: 0, background: "#0a0a0a" }}
    >
      <ShopPoster eager />
      <div ref={hostRef} className="absolute inset-0" />
    </div>
  );
}
