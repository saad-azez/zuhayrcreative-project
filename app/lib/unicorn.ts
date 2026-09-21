/**
 * Single source of truth for the Unicorn Studio WebGL SDK.
 *
 * Every `<UnicornScene>` in the app MUST load the SDK from this exact same URL.
 * The scene host (components/UnicornScene.tsx) dedupes the script tag by its URL string and
 * exposes one global `window.UnicornStudio`. If two scenes request different
 * versions (e.g. v2.2.6 vs v2.1.12), both scripts get appended and the second
 * to execute overwrites the global — wiping out scenes the first already
 * registered. That race is why scenes loaded intermittently. Keeping one URL
 * here guarantees a single script, a single global, and deterministic loading.
 *
 * Scenes are forward-compatible, so it's safe to run an older exported project
 * on this newer runtime.
 */
export const UNICORN_SDK_URL =
  "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.6/dist/unicornStudio.umd.js";

/** Where the SDK fetches scenes and their images from — preconnected early. */
export const UNICORN_ASSETS_ORIGIN = "https://assets.unicorn.studio";

/**
 * The hero scene's image layers: a megabyte of PNG (the colour plate and its
 * 2000x2000 depth map) that the loader is really waiting for on a slow
 * connection. Listed here, not only in HeroBackground, because the resource
 * hints for them are emitted from the document head — see gpuProbe.ts.
 * Re-copy from the network panel whenever the scene is re-exported; dev warns
 * if this drifts from what the scene asks for.
 */
export const HERO_SCENE_IMAGES = [
  "https://assets.unicorn.studio/images/5htle720mmPLOn2tFumZIeia6r42/optimized_colorpop_gamma_direct-2.png",
  "https://assets.unicorn.studio/images/5htle720mmPLOn2tFumZIeia6r42/Colorpop_Gamma_Direct_v1_nobg_1782733240178_depth_1782733451320.png",
  "https://assets.unicorn.studio/media/font_atlas.png",
] as const;
