/**
 * Which background the hero stands on. Three are being compared (client,
 * 13 Oct: "we have our current variant, the new variant with the code file I
 * sent you in it and then this one with the video, the text and logo and all
 * will be in the same place in all three"):
 *
 *   scene   the hero as it has always been: its own Unicorn scene
 *           (HeroBackground)
 *   shop    the client's 3D shop window, standing on that same scene (HeroShop)
 *   video   the "moon walk" loop (HeroVideo)
 *   model   the model lifting her head, driven by scroll (HeroModel; draft)
 *
 * Only the layer BEHIND the headline differs. The logo, the three lines, the
 * Let's Talk link, the lens and the blinds are one piece of markup in
 * HeroBanner, drawn over whichever of these is on.
 *
 * The site's own address shows the site as it was: the scene. The other two
 * each have one address, and that is the whole of it (13 Oct: "on the simple
 * url the website shouldn't look different … add two other urls, one for the
 * shop and another for the video, simple as that"):
 *
 *   /              the hero as it was
 *   /?hero=shop    the 3D shop
 *   /?hero=video   the video
 *   /?hero=model   the model (draft)
 *
 * Nothing is remembered: the address is the only switch, so a link always
 * shows what it says, and the plain address is always the original. When the
 * client has chosen, set HERO_VARIANT and the two addresses can go.
 *
 * No "use client" here, and no hooks: lib/gpuProbe.ts reads this while the
 * server renders the document head.
 */
export type HeroVariant = "scene" | "shop" | "video" | "model";

/** The ones that have an address of their own. */
const ASKED_FOR = ["shop", "video", "model"] as const;

/**
 * What the plain address shows: the scene, unless this machine's own
 * environment says otherwise (NEXT_PUBLIC_HERO_DEFAULT, e.g. in a local
 * .env.development.local, so a dev server can open on a draft). Nothing
 * deployed sets it.
 */
export const HERO_VARIANT: HeroVariant =
  ASKED_FOR.find((v) => v === process.env.NEXT_PUBLIC_HERO_DEFAULT) ?? "scene";
const PARAM = "hero";

/** The variant for this visit: what the address asks for, else the default. Browser only. */
export function readHeroVariant(): HeroVariant {
  const asked = new URLSearchParams(window.location.search).get(PARAM);
  return ASKED_FOR.find((v) => v === asked) ?? HERO_VARIANT;
}

/**
 * readHeroVariant() again, as an expression for the inline script in the
 * document head (gpuProbe.ts), which runs before any module has loaded.
 */
export const HERO_VARIANT_JS = `(function(){var m=/[?&]${PARAM}=([^&#]*)/.exec(location.search);return m&&${JSON.stringify(ASKED_FOR)}.indexOf(m[1])>=0?m[1]:${JSON.stringify(HERO_VARIANT)}})()`;
