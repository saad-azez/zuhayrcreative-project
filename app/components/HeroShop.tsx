"use client";

import { useEffect, useRef, useState } from "react";
import {
  SHOP_ASSETS,
  ShopPoster,
  loadShop,
  shopGoesLive,
  shopIsLite,
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
 * The window is a closed box, and as the scene was designed it stands in a
 * dark surround of its own. Here that surround is left out (`cutout`): the
 * box stands on the hero's own background scene, which HeroBanner mounts
 * behind it (client, 14 Oct: "can it not be there with the unicorn in the
 * background?"). On a phone the box is a band across the middle of a tall
 * screen, and the surround was most of what there was to see.
 *
 * So nothing here is opaque over the whole hero any more: this layer does
 * not claim to cover the page's background (`data-bg-cover`), and has no
 * colour of its own.
 *
 * Timing. Until the loader's curtain is off, only the poster is shown, and
 * nothing of the scene is fetched. Then the scene is sent for at once, but
 * mounted a beat later (MOUNT_AFTER_MS): the headline makes its entrance in
 * that beat, and the scene's first work, though it is in short slices now,
 * is still work on the same thread. The poster is the frame the live window
 * opens on, so the hand-over is a cross-fade between two of the same picture.
 */
const MOUNT_AFTER_MS = 1200;
/**
 * The scene draws its own copy of the poster from the moment it is mounted,
 * and takes it away when the live window is in. This one, which was there
 * for the first paint, has to be gone by then: the surround is transparent
 * now, and a poster left under the live box shows round it as a second box
 * whenever the camera is not exactly where the poster was taken. It goes a
 * moment after the mount, once the scene's copy (the same file, from cache)
 * has certainly been painted; the scene itself is many seconds from live.
 */
const POSTER_HANDOVER_MS = 1500;

export default function HeroShop() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ownPoster, setOwnPoster] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !shopGoesLive()) return;

    let cancelled = false;
    let timer = 0;
    let handover = 0;
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
              // The hero's background shows round the box.
              cutout: true,
              lite: shopIsLite(),
            });
            handover = window.setTimeout(
              () => setOwnPoster(false),
              POSTER_HANDOVER_MS,
            );
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
      window.clearTimeout(handover);
      window.removeEventListener("app:uncovered", start);
      view?.destroy();
    };
  }, []);

  return (
    <div
      data-hero-shop
      data-shop
      className="absolute inset-0 overflow-hidden"
      // Over the hero's background scene (-1) and under its headline (10).
      style={{ zIndex: 0 }}
    >
      {ownPoster && <ShopPoster eager />}
      <div ref={hostRef} className="absolute inset-0" />
    </div>
  );
}
