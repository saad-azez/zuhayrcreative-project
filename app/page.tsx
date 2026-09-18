"use client";

import UnicornBackground from "./components/UnicornBackground";
import { HeroBanner } from "./components/HeroBanner";
import ImpactSection from "./components/ImpactSection";
// import ServicesSection from "./components/ServicesSection"; // (legacy v1 — disabled)
// import ServicesSectionV2 from "./components/ServicesSectionV2"; // (legacy v2 — disabled)
import ServicesSectionV3 from "./components/ServicesSectionV3";
import { VerticalGallery } from "./components/VerticalGallery";
// import OrbitingGallery from "./components/OrbitingGallery"; // (ferris wheel — replaced by WorksRail)
// import WorksRail from "./components/WorksRail"; // (whip rail — replaced by WorksStrip)
// import CaseStrip from "./components/CaseStrip"; // (Patch case study — hidden for now)
import WorksStrip from "./components/WorksStrip";
// The globe is loaded on approach — its three.js is the heaviest thing on the
// page and it is the last section. See SeasonsGlobeLazy for the shell it
// leaves in its place until then.
import SeasonsGlobeLazy from "./components/SeasonsGlobeLazy";
// import TriangleWipe from "./components/TriangleWipe"; // (superseded by PixelWipe — kept for A/B like the other alternates)
import PixelWipe from "./components/PixelWipe";
import SectionSeam from "./components/SectionSeam";
import DebugSection from "./components/debug/DebugSection";
// Hidden for now — reviews section + the section below the footer.
// import Testimonials from "./components/Testimonials";
// import ZuhayrSection from "./components/ZuhayrSection";

/**
 * ── The page's seam rhythm ────────────────────────────────────────────────
 *
 * Two devices, deliberately unequal in weight:
 *
 *   PixelWipe    a full-screen curtain that covers, holds and uncovers.
 *   SectionSeam  a soft blur across the join. No cover, no hold.
 *
 * Every seam used to get the wipe — four of them, back to back, all playing
 * the identical variant. It stopped reading as punctuation: a full opaque
 * cover is the same gesture PageTransition makes for a ROUTE change, so four
 * of them on one page read as leaving the page four times, and the repetition
 * flattened the rhythm rather than shaping it.
 *
 * So the wipe is now spent twice, as far apart as the page allows — two whole
 * sections between them — and in two DIFFERENT variants, so it is never
 * literally the same animation twice:
 *
 *   Services → Gallery   PIXEL WIPE, variant 1 (cells cascade down by row)
 *   Gallery  → Work      seam
 *   Work     → Impact    STROKE WIPE, the `code (14)` SVG squiggle, brand gradient
 *   Impact   → Seasons   seam
 *
 * Hero → Services keeps nothing at all: the page opening stays clean. Nothing
 * follows Seasons either — the footer and its credits arrive plain.
 */

export default function Home() {
  return (
    <>
      {/* Landing-page background — shared Unicorn Studio WebGL scene. */}
      <DebugSection name="Background" note="UnicornBackground — shared Unicorn Studio WebGL scene behind the page" overlay>
        <UnicornBackground />
      </DebugSection>
      {/* overflow-x-clip (not -hidden): clips horizontal overflow the same way
          but does NOT create a scroll container, which would break the services
          section's position:sticky pinned horizontal-scroll. */}
      <main className="relative w-full max-w-full min-h-screen overflow-x-clip">
        <DebugSection name="Hero" note="HeroBanner — headline, glass logo lens, Let's Talk CTA">
          <HeroBanner />
        </DebugSection>
        {/* V3 is the final services section — placed right after hero. */}
        <DebugSection name="Services" note="ServicesSectionV3 — sticky pinned horizontal scroll">
          <ServicesSectionV3 />
        </DebugSection>
        {/* Sits on the gallery side only; straddling the seam put the
            strongest blur over the services' own bottom-left copy. */}
        <DebugSection name="Seam 1" note="blur seam under Services">
          <SectionSeam anchor="below" />
        </DebugSection>
        {/* <ServicesSection /> */}
        {/* <ServicesSectionV2 /> */}
        {/* ── WIPE 1 of 2: services → gallery. Variant 1, the row cascade. ── */}
        <DebugSection name="Wipe 1" note="PixelWipe pixel cascade, Services → Gallery">
          <PixelWipe variant={1} />
        </DebugSection>
        <DebugSection name="Gallery" note="VerticalGallery — image grid + lightbox">
          <VerticalGallery />
        </DebugSection>
        {/* Gallery → work: a seam, not a wipe. No breathing room either — the
            gallery's own bottom padding separates the two, and the work
            section's dark overlay fades in over this same zone, so the blur
            and that fade dissolve the join between them. An explicit gap here
            only pushed the two apart (it was tried, and removed).

            Anchored ABOVE the seam: the work section's head text starts a
            couple of rem in, and a band straddling the join would blur the
            "Selected Work" line itself. */}
        {/* Taller than the other seams (36vh, not 160px): the client asked for
            the black blur above and below the work section to be extended,
            alongside the work section's own dark plane (works-strip.css). */}
        <DebugSection name="Seam 2" note="36vh blur seam above Work">
          <SectionSeam anchor="above" band="h-[36vh]" />
        </DebugSection>
        {/* Work section — the case strip's layout and motion carrying the
            rail's content: the Selected Work head, a caption per plate, and
            the click-to-open enlarged view. Carries the #work anchor the
            navbar's "Work" link points at. The rail itself (WorksRail) stays
            in the tree, unmounted, like the ferris wheel before it. */}
        <DebugSection name="Work" note="WorksStrip — #work, the drifting plate strip">
          <WorksStrip />
        </DebugSection>
        {/* Mirrors the band above the work section — this one sits wholly
            BELOW the seam, over the top of the wipe's runway. Lengthened with
            the one above. */}
        <DebugSection name="Seam 3" note="36vh blur seam below Work">
          <SectionSeam anchor="below" band="h-[36vh]" />
        </DebugSection>
        {/* ── WIPE 2 of 2: work → impact, the page's biggest structural break,
            and the furthest point from wipe 1. The client swapped its pixels
            for the `code (14)` SVG transition: a squiggle stroke that draws
            across the screen as it thickens to cover it, then erases from its
            start as it thins away — in the curtain's brand gradient, so it is
            a different gesture from the cascade above in the same colours.

            It renders a sub-screen spacer (the sections' breathing room) plus
            a fixed curtain layer, and plays across that seam's travel through
            the viewport: cover over the work section's tail, hold through the
            gap, then uncover the impact section rising beneath. ── */}
        <DebugSection name="Wipe 2" note="PixelWipe stroke squiggle, Work → Impact">
          <PixelWipe drawing="stroke" />
        </DebugSection>
        <DebugSection name="Impact" note="ImpactSection">
          <ImpactSection />
        </DebugSection>
        {/* Impact → seasons: a seam, with the breathing room the globe wants
            restored. That spacer predates the wipes and was only dropped
            because the wipe's own 75vh gap stood in for it; with the wipe gone
            the globe needs its room back or it butts straight onto the impact
            section's last line. */}
        <DebugSection name="Seam 4" note="seam + spacer above Seasons">
          <SectionSeam anchor="above" gap="h-[10vh] md:h-[16vh]" />
        </DebugSection>
        {/* Seasons — the club globe, moved here as the last section before the
            footer (nav "Seasons" → #seasons). Sits over the shared background
            and supplies its own interaction; the page keeps the footer below.
            Nothing after it: the footer (and its credits) arrive plain. */}
        <DebugSection name="Seasons" note="SeasonsGlobeLazy — three.js globe, loaded on approach">
          <SeasonsGlobeLazy />
        </DebugSection>
        {/* <Testimonials /> — reviews section hidden */}
        {/* Footer is shared — rendered once by the template (SiteFooter). */}
      </main>
    </>
  );
}
