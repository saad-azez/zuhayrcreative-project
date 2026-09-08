/**
 * Section seam — the landing page's QUIET transition between two sections.
 *
 * A band of masked `backdrop-blur` across the join, optionally over a little
 * breathing room. Nothing covers, nothing holds, nothing takes the screen: the
 * shared background simply goes soft for 160px and comes back, so the eye
 * crosses the boundary without being stopped at it.
 *
 * ── Why this exists as the default, and PixelWipe does not ──
 * PixelWipe draws a full-screen opaque curtain, holds it, and uncovers — the
 * same block-grid language as PageTransition, which is the ROUTE change. Used
 * on four seams in a row it stopped reading as punctuation and started reading
 * as leaving the page four times on one page. So the wipe is now spent
 * sparingly, on two seams far apart, and every other join uses this instead.
 * The two are a rhythm together: a wipe means "a new chapter", a seam means
 * "the next paragraph".
 *
 * The band is drawn out of a ZERO-HEIGHT wrapper so it takes no layout of its
 * own and cannot push the sections apart — `gap` is the only thing here that
 * occupies space, and it is separate on purpose.
 */
export default function SectionSeam({
  anchor = "above",
  gap,
}: {
  /**
   * Which side of the join the blur band hangs on.
   *
   * `"above"` — the band sits wholly BEFORE the seam, in the gap. Use it when
   * the section below opens with type close to its top edge: a band straddling
   * the join would blur that type (the work section's "Selected Work" head is
   * exactly this case).
   *
   * `"below"` — the band sits wholly AFTER the seam, over the incoming
   * section's first 160px. Use it when the section below starts a comfortable
   * way in and the section ABOVE is the one ending on copy.
   */
  anchor?: "above" | "below";
  /**
   * Optional breathing room, as Tailwind height classes. Omit where the
   * neighbouring sections' own padding already separates them.
   */
  gap?: string;
}) {
  return (
    <>
      {gap ? <div aria-hidden className={`w-full ${gap}`} /> : null}
      <div aria-hidden className="relative z-20 h-0 pointer-events-none">
        <div
          className={`absolute left-0 right-0 h-40 backdrop-blur-xl ${
            anchor === "above" ? "bottom-0" : "top-0"
          }`}
          // Feathered at both ends, so the blur has no edge of its own — an
          // unmasked band announces itself as a rectangle of frosted glass
          // sliding up the page, which is a worse artefact than the hard seam
          // it was brought in to hide.
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, #000 32%, #000 68%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, #000 32%, #000 68%, transparent 100%)",
          }}
        />
      </div>
    </>
  );
}
