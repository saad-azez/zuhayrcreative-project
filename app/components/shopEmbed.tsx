import { hasGPU } from "@/app/lib/gpu";
import { isPhoneDevice } from "@/app/lib/device";
import "@/app/styles/shop-poster.css";

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
 * Do phones get the live window, or its poster?
 *
 * ON since 14 Oct. While it was off a phone showed the poster and nothing
 * else, and that is what the client was looking at when he asked: "none of
 * the animations are working, is it because the code file was incomplete?"
 * The code was complete; the phone was being handed a photograph of it.
 *
 * What a phone is given is lighter than a desktop's: the 1K texture set
 * (`lite`, see shopIsLite), 15 MB of scans where the full set is 45. The
 * scene still steps itself down on a machine that cannot keep up (pixel
 * ratio, then half rate, then back to the poster: shop/README.md, "Pacing").
 * That answers a slow frame; it does not answer a tab the OS closes for
 * memory, and this has been run on an emulated phone, not on a real one.
 * Turn it off again here if real phones say so.
 */
export const LIVE_ON_PHONES: boolean = true;

export interface ShopModule {
  mountShop(
    el: HTMLElement,
    props?: {
      assetBase?: string;
      approach?: string;
      yieldToScroll?: boolean;
      /** The box's surround left transparent, for a host with a background of its own. */
      cutout?: boolean;
      /** The light texture set. */
      lite?: boolean;
    },
  ): { destroy(): void };
}

/** Phones are given the light texture set. */
export const shopIsLite = (): boolean => isPhoneDevice();

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
 *    measures as 2G or 3G, it is the poster: the live window is tens of
 *    megabytes of textures, which is not something to spend for a visitor
 *    unasked.
 *  - On phones it is the live window too, on the light set (LIVE_ON_PHONES
 *    and shopIsLite, above).
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

/**
 * The scene's own poster, as the scene draws it itself. The surround of the
 * box is transparent in it, so the one picture serves a placement that puts
 * the page's background round the box (HeroShop) and one that keeps the dark
 * surround (ShopSection, which paints that colour behind it).
 */
/**
 * Which of the two poster pictures, and how it is sized (shop-poster.css):
 * the same rule the scene's own copy follows, which is the way its camera
 * frames the live window. shop/src/ShopWindow.tsx has the reasoning.
 */
const POSTER_BY_WIDTH = "(max-aspect-ratio: 29/20)";

export function ShopPoster({ eager = false }: { eager?: boolean }) {
  return (
    <picture>
      <source
        media={POSTER_BY_WIDTH}
        type="image/avif"
        srcSet={`${SHOP_ASSETS}poster-portrait.avif`}
      />
      <source
        media={POSTER_BY_WIDTH}
        srcSet={`${SHOP_ASSETS}poster-portrait.webp`}
      />
      <source type="image/avif" srcSet={`${SHOP_ASSETS}poster.avif`} />
      <img
        src={`${SHOP_ASSETS}poster.webp`}
        alt=""
        aria-hidden
        draggable={false}
        // In the hero it is the first screen; further down the page it is
        // not part of the first load.
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="shop-poster"
      />
    </picture>
  );
}
