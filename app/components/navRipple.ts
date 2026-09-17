"use client";

import { SPLASH } from "./useSplashHover";
import { createDisplaceWave, type DisplaceWave } from "./displaceWave";

/**
 * The wave that runs across the screen when the navbar toggle is clicked.
 *
 * It is the ripple the expanded images carry (useSplashHover) and the click
 * ripple carries (clickDisplace) — a train of concentric rings that BENDS THE
 * PAGE'S OWN PIXELS, no colour, no highlight — let loose across the whole
 * viewport: born at the toggle, the train swells from the button to past the
 * far corner of the screen in about a second, its bend fading as it goes, so
 * everything on screen, the menu opening over it included, is passed through
 * by the wave.
 *
 * HOW: a full-viewport overlay carrying a backdrop-filter displacement — see
 * displaceWave.ts (once shared with the corner dock's pond). The overlay
 * sits between the veil and the navbar, so the toggle itself is not bent.
 *
 * THE MAP differs from the click ripple's in where its energy sits. The image ripple's envelope hugs the origin, which
 * is right for a splash under the cursor and wrong for a wave that has to
 * cross the screen — by mid-screen that train is a few pixels deep. Here the
 * envelope rides the FRONT: six rings, strongest in the outer third of the
 * radius with a soft tail behind, so what travels is a crest with wake, and
 * the bend eases off slowly enough to still be a wave when it leaves.
 *
 * Where url() in backdrop-filter does not render — every iPhone browser, and
 * Firefox — the wave bends the TARGET instead (displaceWave's element route):
 * the menu's words layer, which fills the screen as the menu opens and is
 * what has detail to bend. It used to return null there, and the toggle's
 * tap on a phone sent no wave at all.
 */

/** Rings inside the map's radius. */
const RINGS = 6;
/** Where the crest sits on the map's 0..1 radius, and how wide it is. */
const FRONT = 0.72;
const FRONT_WIDTH = 0.22;
/** Peak bend, px — 1.5x the image ripple's, for the size of the thing. */
const AMPLITUDE = SPLASH.amplitude * 420 * 1.5;
/** How long the wave lives, ms. */
const DURATION = 1250;
/** The train's radius at birth and at death, as fractions of the screen's
    half-diagonal — from just outside the toggle to past the far corner. */
const R0 = 0.16;
const R1 = 1.25;

export type NavRipple = DisplaceWave;

/**
 * The machinery — the baked map, the filter, the overlay, the frame loop —
 * lives in displaceWave.ts. What is the nav wave's own is here: the
 * crest-riding envelope, the screen-sized radius schedule and the
 * full-viewport overlay.
 */
export function createNavRipple(target?: () => HTMLElement | null): NavRipple | null {
  return createDisplaceWave({
    id: "nav-ripple",
    target,
    rings: RINGS,
    // The crest: a bell about FRONT, with a longer tail behind it than
    // ahead, and a hard fade to nothing at the rim.
    envelope: (n) => {
      const u = (n - FRONT) / (n < FRONT ? FRONT_WIDTH * 1.8 : FRONT_WIDTH);
      return Math.exp(-u * u) * Math.min(1, (1 - n) / 0.1);
    },
    amplitude: AMPLITUDE,
    duration: DURATION,
    radii: () => {
      const half = Math.hypot(window.innerWidth, window.innerHeight) / 2;
      return [half * R0, half * R1];
    },
    // The train swells at a wave's near-steady pace, easing only at the
    // end, and its bend eases off slowly — still most of itself at
    // mid-screen, gone as it leaves.
    swell: (t) => 1 - Math.pow(1 - t, 1.6),
    fade: (age) => Math.pow(age, 0.7),
    box: "viewport",
    zIndex: 95, // over the menu veil (90), under the navbar (100)
  });
}
