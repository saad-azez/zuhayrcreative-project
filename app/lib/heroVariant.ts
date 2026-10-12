/**
 * Which background the hero stands on. Three are being compared (client,
 * 13 Oct: "we have our current variant, the new variant with the code file I
 * sent you in it and then this one with the video, the text and logo and all
 * will be in the same place in all three"):
 *
 *   scene   the hero as it has been: its own Unicorn scene (HeroBackground)
 *   shop    the client's 3D shop window (HeroShop)
 *   video   the "moon walk" loop (HeroVideo)
 *
 * Only the layer BEHIND the headline differs. The logo, the three lines, the
 * Let's Talk link, the lens and the blinds are one piece of markup in
 * HeroBanner, drawn over whichever of these is on.
 *
 * HERO_VARIANT is what a visitor gets. For the comparison, any of the three
 * can be asked for in the address:
 *
 *   /?hero=scene     /?hero=shop     /?hero=video
 *
 * and the choice is kept for that tab (sessionStorage), so it survives a walk
 * round the site and back to the home page. `/?hero=default` (any value that
 * is not one of the three) forgets it. When the client has chosen: set
 * HERO_VARIANT, and the address switch can stay or go with nothing else
 * depending on it.
 *
 * No "use client" here, and no hooks: lib/gpuProbe.ts reads this while the
 * server renders the document head.
 */
export const HERO_VARIANTS = ["scene", "shop", "video"] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];

export const HERO_VARIANT: HeroVariant = "shop";

const PARAM = "hero";
const KEY = "hero-variant";

const isVariant = (v: string | null): v is HeroVariant =>
  (HERO_VARIANTS as readonly string[]).includes(v ?? "");

/**
 * The variant for this visit. Browser only, and it only reads: asked for in
 * the address, else remembered for the tab, else the default.
 */
export function readHeroVariant(): HeroVariant {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has(PARAM)) {
      const asked = params.get(PARAM);
      return isVariant(asked) ? asked : HERO_VARIANT;
    }
    const kept = window.sessionStorage.getItem(KEY);
    if (isVariant(kept)) return kept;
  } catch {
    // Storage can be refused (private modes, embedded views): the default.
  }
  return HERO_VARIANT;
}

/** Keep (or forget) what the address asked for, for the rest of the tab. */
export function rememberHeroVariant(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has(PARAM)) return;
    const asked = params.get(PARAM);
    if (isVariant(asked)) window.sessionStorage.setItem(KEY, asked);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}

/**
 * readHeroVariant() again, as an expression for the inline script in the
 * document head (gpuProbe.ts), which runs before any module has loaded.
 */
export const HERO_VARIANT_JS = `(function(){var d=${JSON.stringify(HERO_VARIANT)},a=${JSON.stringify(HERO_VARIANTS)};try{var m=/[?&]${PARAM}=([^&#]*)/.exec(location.search);if(m)return a.indexOf(m[1])<0?d:m[1];var k=sessionStorage.getItem(${JSON.stringify(KEY)});if(k&&a.indexOf(k)>=0)return k}catch(e){}return d})()`;
