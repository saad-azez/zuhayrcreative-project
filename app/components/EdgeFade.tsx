/**
 * Edge fade — the top and bottom strips of the viewport, dissolved into the
 * page's own canvas colour.
 *
 * ── The problem this solves ──
 * iOS Safari fills the area behind the status bar and behind the bottom toolbar
 * with a single flat colour taken from the page (theme-color, falling back to
 * the root element's background). It is not translucent and no page can make it
 * so. The only question is whether that colour matches what the page is drawing
 * next to it.
 *
 * On zuhayrcreative.org it does, which is why that site appears to run edge to
 * edge with the clock and wifi icon sitting straight on the page. Not a trick —
 * its background is uniformly dark maroon, so the fill happens to be invisible
 * against it. (It does not even set viewport-fit=cover.)
 *
 * Here the background is an animated WebGL scene that spends much of its time
 * pale grey, so the same flat fill reads as two black bars pinned to the top
 * and bottom of the screen, through the whole scroll. Matching it with a static
 * colour is impossible, and matching it dynamically is impossible too: the
 * Unicorn SDK creates its context without preserveDrawingBuffer, so the scene's
 * pixels cannot be read back — drawImage off that canvas returns pure black.
 *
 * ── So bring the page to the colour instead ──
 * Rather than chase the scene, fade the scene into the fill at both edges. The
 * strip Safari paints then meets page content of the same colour and the seam
 * disappears, which is the reference site's look arrived at deliberately.
 *
 * FADE_TO must stay equal to the root background in globals.css and the
 * theme-color in layout.tsx. Those three are one value in three places; change
 * one and the seam comes back.
 */

/** The colour the edges resolve to — the page background's darkest stop. */
const FADE_TO = "#1a070d";

/**
 * How far the fade reaches past the safe area, in px.
 *
 * It has to clear the inset itself plus enough runway that the gradient reads
 * as a vignette rather than as a second, softer band. Under the collapsed
 * bottom toolbar there is more to cover than under the status bar.
 */
const TOP_RUN = 56;
const BOTTOM_RUN = 72;

export default function EdgeFade() {
  return (
    <div
      aria-hidden
      // z-0, and it matters. The two scene layers sit at z-index -10
      // (UnicornBackground) and -1 (HeroBackground); `main` is position:
      // relative with z-index auto, so it creates no stacking context and its
      // content participates in the root one at auto. A fixed layer at 0
      // therefore lands ABOVE both scenes and BELOW every piece of content —
      // so this darkens the background at the edges without dimming the type,
      // the navbar or the footer sitting over it.
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: [
          `linear-gradient(to bottom, ${FADE_TO} 0px, ${FADE_TO} calc(var(--safe-top, 0px) * 0.6), transparent calc(var(--safe-top, 0px) + ${TOP_RUN}px))`,
          `linear-gradient(to top, ${FADE_TO} 0px, ${FADE_TO} calc(var(--safe-bottom, 0px) * 0.6), transparent calc(var(--safe-bottom, 0px) + ${BOTTOM_RUN}px))`,
        ].join(", "),
      }}
    />
  );
}
