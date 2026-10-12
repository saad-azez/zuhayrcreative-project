import { hasGPU } from "@/app/lib/gpu";
import { isPhoneDevice } from "@/app/lib/device";

/**
 * What the two placements of the 3D shop share (HeroShop, in the hero;
 * ShopSection, a section of its own): where its files are, the module that
 * draws it, its poster, and who gets the live window rather than the poster.
 *
 * The scene itself is the client's own code, in `shop/` at the root of the
 * repo, and it is NOT part of this app's bundle. It is built there into one
 * self-contained module — its own React, and three at the version the scene
 * was written for — and served from `public/shop/` beside its textures. A
 * placement imports that module at run time, past the bundler, the way
 * NotebookEmbed does. shop/README.md has the why, and the numbers.
 */
export const SHOP_ASSETS = "/shop/";

/**
 * Phones get the poster, not the live window, unless this is turned on.
 *
 * It has not been run on a phone. The scene steps itself down on a machine
 * that cannot keep up (pixel ratio, then half rate, then back to the poster:
 * shop/README.md, "Pacing"), but that answers a slow frame, not a tab the OS
 * kills for memory, and a mirror, a reflecting floor, three shadowed lights
 * and a post-processing stack are a great deal of memory for a phone. This is
 * a guard on the trial, not a decision about the design.
 */
export const LIVE_ON_PHONES: boolean = false;

export interface ShopModule {
  mountShop(
    el: HTMLElement,
    props?: { assetBase?: string; approach?: string; yieldToScroll?: boolean },
  ): { destroy(): void };
}

/** The module, fetched the first time it is asked for. */
export function loadShop(): Promise<ShopModule> {
  const url = `${SHOP_ASSETS}shop-window.js`;
  return import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ url
  ) as Promise<ShopModule>;
}

/**
 * Does this visitor get the live window? Otherwise the poster stays, which is
 * the frame the live window opens on.
 *
 *  - With no GPU (lib/gpu.ts) it is the poster, as for every scene.
 *  - On a connection that has asked to save data, or that the browser
 *    measures as 2G or 3G, it is the poster: the live window is 60 MB of
 *    textures, which is not something to spend for a visitor unasked.
 *  - On phones it is the poster too, for now (LIVE_ON_PHONES, above).
 */
export function shopGoesLive(): boolean {
  if (!hasGPU()) return false;
  if (!LIVE_ON_PHONES && isPhoneDevice()) return false;
  // Where the browser says (Chromium does; elsewhere this is undefined and
  // the window goes live).
  const link = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  return !(link?.saveData || /(^|-)[23]g$/.test(link?.effectiveType ?? ""));
}

/** The scene's own poster, as its embed entry (ShopWindowSection) draws it. */
export function ShopPoster({ eager = false }: { eager?: boolean }) {
  return (
    <picture>
      <source
        media="(orientation: portrait)"
        type="image/avif"
        srcSet={`${SHOP_ASSETS}poster-portrait.avif`}
      />
      <source
        media="(orientation: portrait)"
        srcSet={`${SHOP_ASSETS}poster-portrait.jpg`}
      />
      <source type="image/avif" srcSet={`${SHOP_ASSETS}poster.avif`} />
      <img
        src={`${SHOP_ASSETS}poster.jpg`}
        alt=""
        aria-hidden
        draggable={false}
        // In the hero it is the first screen; further down the page it is
        // not part of the first load.
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </picture>
  );
}
