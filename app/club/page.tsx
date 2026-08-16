import type { Metadata } from "next";
import UnicornBackground from "../components/UnicornBackground";
import ClubSlider from "../components/ClubSlider";

export const metadata: Metadata = {
  title: "The Club",
  description:
    "The Club — an endless strip from Zuhayr Creative's archive. Drag to explore.",
};

/**
 * The Club.
 *
 * The whole page is the slider. The navbar and the footer are not rendered
 * here — app/template.tsx supplies both to every route — so this file only
 * owns the section between them.
 *
 * The FlyingPosters placeholder that used to live here is gone, replaced by the
 * slider. The shared background stays: the strip is bottom-aligned and its
 * left-hand slides are slivers, so a good half of the viewport — the whole band
 * above the images and the space beside the heading — is background.
 */
export default function ClubPage() {
  return (
    <>
      {/* Shared Unicorn Studio WebGL background — the same fixed scene as the
          landing page and careers (z -10). The slider paints over it. */}
      <UnicornBackground />
      <main className="relative w-full max-w-full overflow-x-hidden">
        <ClubSlider />
      </main>
    </>
  );
}
