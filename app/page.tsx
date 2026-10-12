"use client";

import { lazy } from "react";
import UnicornBackground from "./components/UnicornBackground";
import { HeroBanner } from "./components/HeroBanner";
import LazyHydrate from "./components/LazyHydrate";
/* The four sections below the hero keep their server-rendered HTML but are
   not hydrated — not even fetched — until the reader is on the way to them;
   LazyHydrate has the rule. These `lazy` components are only ever rendered
   on the SERVER. On the client LazyHydrate brings the same module in itself
   when it is time, so none of the four is part of the first-load bundle. */
const ServicesSectionV3 = lazy(() => import("./components/ServicesSectionV3"));
const VerticalGallery = lazy(
  () => import("./components/VerticalGallery/VerticalGallery"),
);
const WorksStrip = lazy(() => import("./components/WorksStrip"));
const ImpactSection = lazy(() => import("./components/ImpactSection"));
/* Their stylesheets, however, belong to the first byte: the server renders
   the sections' HTML in full, and that HTML has to lay out as designed
   before any of their code has arrived — without these, the page was 6,000px
   taller until the reveal. The sections import the same files themselves;
   a stylesheet is only ever included once. */
import "./styles/services-section-v3.css";
import "./styles/chromatic-metal.css";
import "./styles/gallery.css";
import "./styles/case-strip.css";
import "./styles/works-strip.css";
import "./styles/works-rail.css";
import "./styles/repeat-text.css";
import "./styles/rolling-number.css";
// import ServicesSection from "./components/ServicesSection"; // (legacy v1 — disabled)
// import ServicesSectionV2 from "./components/ServicesSectionV2"; // (legacy v2 — disabled)
// import OrbitingGallery from "./components/OrbitingGallery"; // (ferris wheel — replaced by WorksRail)
// import WorksRail from "./components/WorksRail"; // (whip rail — replaced by WorksStrip)
// import CaseStrip from "./components/CaseStrip"; // (Patch case study — hidden for now)
// The globe is loaded on approach — its three.js is the heaviest thing on the
// page and it is the last section. See SeasonsGlobeLazy for the shell it
// leaves in its place until then.
import SeasonsGlobeLazy from "./components/SeasonsGlobeLazy";
// import TriangleWipe from "./components/TriangleWipe"; // (superseded by PixelWipe — kept for A/B like the other alternates)
/* The wipes paint a fixed, full-screen curtain and carry no text. They are
   mounted on approach, like the sections around them; until then only their
   seam spacer is on the page, server-rendered. See PixelWipeLazy. */
import PixelWipe from "./components/PixelWipeLazy";
import SectionSeam from "./components/SectionSeam";
// The client's 3D shop as a section (switched off; it is in the hero: see
// SHOW_SHOP_SECTION below, and HeroShop).
import ShopSection from "./components/ShopSection";
// import MarbleSeam from "./components/MarbleSeam"; // (marble seam — hidden for now, see SHOW_MARBLE_SEAM)

/* The two section transitions (the PixelWipes below), hidden for now: the
   client, 4 Oct — "I think its ruining the flow of the site I need to think
   about placing them better or not having them at all". Flip to true to
   bring both back exactly as they were. */
const SHOW_SECTION_WIPES = false;
/* The client's 3D shop as a section of its own, between work and impact.
   OFF: the window is in the hero at the moment (client, 13 Oct: "add the shop
   on the hero section back again"), as one of the three hero backgrounds
   being compared (HERO_VARIANT, lib/heroVariant.ts), and the two placements
   are the same scene, so it is one or the other. Kept because the client has
   not settled where it lives: to put it back here, turn this on and move
   HERO_VARIANT off "shop". */
const SHOW_SHOP_SECTION: boolean = false;
/* The marble seam (MarbleSeam): the services → gallery transition after
   scrolltide's "Marble Scroll" (client, 10 Oct), in place of the first wipe
   while this is on. It rides the boundary itself — no spacer, no curtain —
   so it does not need the wipe's room. Off, the old wipe is back under
   SHOW_SECTION_WIPES, for comparison. */
// Hidden for now (client, 12 Oct): not imported or rendered at all, so it
// adds nothing to the page. To bring it back, restore the import above and
// the line in the gallery seam below.
// const SHOW_MARBLE_SEAM = true;
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
      <UnicornBackground />
    
      {/* overflow-x-clip (not -hidden): clips horizontal overflow the same way
          but does NOT create a scroll container, which would break the services
          section's position:sticky pinned horizontal-scroll. */}
      <main className="relative w-full max-w-full min-h-screen overflow-x-clip">
        <HeroBanner />
      
        {/* V3 is the final services section — placed right after hero. */}
        <LazyHydrate
          load={() => import("./components/ServicesSectionV3")}
          server={<ServicesSectionV3 />}
        />
      
        {/* Sits on the gallery side only; straddling the seam put the
            strongest blur over the services' own bottom-left copy. */}
        <SectionSeam anchor="below" />
      
        {/* <ServicesSection /> */}
        {/* <ServicesSectionV2 /> */}
        {/* ── WIPE 1 of 2: services → gallery. Variant 1, the row cascade. ── */}
        {/* {SHOW_MARBLE_SEAM ? <MarbleSeam /> : …} — marble seam hidden */}
        {SHOW_SECTION_WIPES && <PixelWipe variant={1} />}
      
        <LazyHydrate
          load={() => import("./components/VerticalGallery/VerticalGallery")}
          server={<VerticalGallery />}
        />
      
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
        <SectionSeam anchor="above" band="h-[36vh]" />
      
        {/* Work section — the case strip's layout and motion carrying the
            rail's content: the Selected Work head, a caption per plate, and
            the click-to-open enlarged view. Carries the #work anchor the
            navbar's "Work" link points at. The rail itself (WorksRail) stays
            in the tree, unmounted, like the ferris wheel before it. */}
        <LazyHydrate
          load={() => import("./components/WorksStrip")}
          server={<WorksStrip />}
        />
      
        {/* Mirrors the band above the work section — this one sits wholly
            BELOW the seam, over the top of the wipe's runway. Lengthened with
            the one above. */}
        <SectionSeam anchor="below" band="h-[36vh]" />
      
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
        {SHOW_SECTION_WIPES && <PixelWipe drawing="stroke" />}
        {/* With the wipe hidden, its runway is room the seam band above still
            needs: the 36vh band hangs below the work section, and without
            this it lay over the impact headings and blurred them. As tall as
            the band, so what it blurs is background. */}
        {!SHOW_SECTION_WIPES && <div aria-hidden style={{ height: "36vh" }} />}

        {/* The 3D shop ("Paint to Pixel") as a section of its own — not
            mounted while it is in the hero (SHOW_SHOP_SECTION, above). Its
            place when it is: the page's biggest break, the one the second
            wipe used to mark, with work behind and figures ahead and neither
            neighbour drawing a scene of its own while this one fills the
            screen. */}
        {SHOW_SHOP_SECTION && <ShopSection />}
      
        <LazyHydrate
          load={() => import("./components/ImpactSection")}
          server={<ImpactSection />}
        />
      
        {/* Impact → seasons: a seam, with the breathing room the globe wants
            restored. That spacer predates the wipes and was only dropped
            because the wipe's own 75vh gap stood in for it; with the wipe gone
            the globe needs its room back or it butts straight onto the impact
            section's last line. */}
        <SectionSeam anchor="above" gap="h-[10vh] md:h-[16vh]" />
      
        {/* Seasons — the club globe, moved here as the last section before the
            footer (nav "Seasons" → #seasons). Sits over the shared background
            and supplies its own interaction; the page keeps the footer below.
            Nothing after it: the footer (and its credits) arrive plain. */}
        <SeasonsGlobeLazy />
      
        {/* <Testimonials /> — reviews section hidden */}
        {/* Footer is shared — rendered once by the template (SiteFooter). */}
      </main>
    </>
  );
}
