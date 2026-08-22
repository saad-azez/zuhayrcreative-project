/**
 * Edge fade — dissolves the page into the colour Safari paints at the screen
 * edges, so the strips above and below the layout viewport stop reading as
 * bars.
 *
 * ── What the device actually measured (iPhone, Safari 26.6, ?edges=1) ──
 *
 *     window.inner   390 x 699
 *     screen         390 x 844
 *     env insets     0 / 0 / 0 / 0      (WITH viewport-fit=cover in the meta)
 *
 * 145px of the screen — behind the status bar, behind the toolbar — is never
 * the page's to paint on this Safari. viewport-fit=cover does NOT hand it
 * over: the measurement above was taken with cover live, and the page stayed
 * inset. Safari fills those strips itself with one flat colour taken from the
 * page (theme-color / body background — engine-dependent, both pinned to
 * --page-edge here), and nothing a page does makes that fill translucent.
 *
 * So the only question is whether the flat fill matches what the page draws
 * BESIDE it. The client's reference site (old zuhayrcreative.org) has no bars
 * while doing nothing clever — bare viewport meta, theme-color #470015 —
 * because its page is uniformly that same maroon, so Safari's fill is
 * invisible against it. Here the background is an animated WebGL scene that
 * spends much of its time pale grey, so the same fill reads as two dark bars
 * pinned to the screen through the whole scroll.
 *
 * Matching the fill to the scene is impossible. Statically, because the scene
 * animates; dynamically, because the Unicorn SDK builds its context without
 * preserveDrawingBuffer, so the scene cannot be read back — drawImage off
 * that canvas returns pure black.
 *
 * ── So bring the page to the colour instead ──
 * Fade the background into --page-edge at both edges. The strip Safari paints
 * then meets page content of the same colour and the seam disappears — the
 * reference site's look, arrived at deliberately.
 *
 * HISTORY, so this is not deleted a second time: this layer shipped in
 * 16c5baf and was removed nine minutes later (1380438) on the theory that
 * dropping viewport-fit would leave translucent chrome with no bar to hide.
 * The on-device measurement above, taken days later, disproved that theory —
 * the strips are Safari's own and opaque no matter what the viewport says.
 * This fade is the one piece that closes the seam; the strip colour
 * (--page-edge on body/html, themeColor in layout.tsx) is the other half.
 * Both halves have to be present at once.
 */

/**
 * How far the fade reaches past the safe-area inset, in px.
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
      // it darkens the background at the edges without dimming the type, the
      // navbar or the footer sitting over it.
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        // var(--page-edge) rather than a literal: globals.css owns the value,
        // and the seam only stays closed while this, body/html's background
        // and themeColor in layout.tsx agree.
        background: [
          `linear-gradient(to bottom, var(--page-edge) 0px, var(--page-edge) calc(var(--safe-top, 0px) * 0.6), transparent calc(var(--safe-top, 0px) + ${TOP_RUN}px))`,
          `linear-gradient(to top, var(--page-edge) 0px, var(--page-edge) calc(var(--safe-bottom, 0px) * 0.6), transparent calc(var(--safe-bottom, 0px) + ${BOTTOM_RUN}px))`,
        ].join(", "),
      }}
    />
  );
}
