"use client";

/**
 * The Seasons globe's four photographs, and the URL they are actually loaded
 * from.
 *
 * ── Why this is its own module ──
 * Two things need the list: the globe, which uploads them as WebGL textures,
 * and SeasonsGlobeLazy, which warms them during idle time so they are in cache
 * before the reader arrives. The globe pulls in three.js and react-three-fiber
 * — a fifth of the landing page's JavaScript — so the warm-up cannot import it
 * to find out what to warm. Hence a module with no dependencies at all.
 *
 * ── Why not the raw files ──
 * The originals are 2000x2000 PNGs, 400-560 KB each and 1.9 MB together, and
 * they are drawn as roughly 40px tiles on a 252-tile globe; the largest they
 * are ever shown is one photograph opened to the middle of the screen. Served
 * through the image optimizer at 640px they come back as AVIF at 25-41 KB —
 * about 120 KB for all four, sixteen times less — and the same URL feeds the
 * DOM image the open/close trail flies, so nothing loads the 2000px version at
 * all any more. Same trick the corner dock's stamp already uses.
 *
 * 640 because that is the smallest of next.config's `deviceSizes` and still
 * comfortably above what a full-screen open needs; `imageSizes` stops at 384,
 * which is enough for the tiles but soft when one is opened. Quality 75 is the
 * project's default — other values are not in the allowlist and 400 out.
 */

export interface ClubImage {
  /** The file in `public/`, kept for reference — nothing loads this directly. */
  file: string;
  /** What everything actually loads: the optimizer's URL for `file`. */
  src: string;
  title: string;
  date: string;
}

const TEXTURE_W = 640;
const TEXTURE_Q = 75;

/** The optimizer's URL for a file in `public/`. */
export function seasonsTextureUrl(file: string): string {
  return `/_next/image?url=${encodeURIComponent(file)}&w=${TEXTURE_W}&q=${TEXTURE_Q}`;
}

function image(file: string, title: string, date: string): ClubImage {
  return { file, src: seasonsTextureUrl(file), title, date };
}

/**
 * ⚠️ Titles/dates are placeholders — tweak to taste.
 */
export const SEASONS_IMAGES: ClubImage[] = [
  image("/AI-7.png", "Tokyo", "Cherry Blossom"),
  image("/AI-15.png", "Hong Kong", "Bauhinia"),
  image("/AI-12.png", "Lunar", "Year of the Dragon"),
  image("/AI-14.png", "Singapore", "Marina Bay"),
];

/**
 * Pull the four into the browser's cache.
 *
 * The globe's CODE was already warmed on approach, but its pictures were not:
 * three.js only asks for them when the scene mounts, and the whole scene sits
 * behind a Suspense that shows nothing until every one has landed — so the
 * reader watched an empty section for as long as the download took. Warming
 * them with the code means the mount finds them already there.
 *
 * A plain <img> is the right tool: it shares the HTTP cache with the loader
 * three.js will use, decodes off the main thread, and is thrown away here
 * while the browser keeps the bytes. Failures are ignored on purpose — this is
 * a warm-up, and the real load will report its own trouble.
 */
export function warmSeasonsTextures(): void {
  if (typeof window === "undefined") return;
  for (const { src } of SEASONS_IMAGES) {
    const im = new Image();
    im.decoding = "async";
    im.src = src;
  }
}
