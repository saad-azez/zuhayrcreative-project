/**
 * Single source of truth for the Unicorn Studio WebGL SDK.
 *
 * Every `<UnicornScene>` in the app MUST load the SDK from this exact same URL.
 * The unicornstudio-react loader dedupes the script tag by its URL string and
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
