import type { Metadata } from "next";
import Link from "next/link";
// import UnicornBackground from "../components/UnicornBackground";
// import ClubSlider from "../components/ClubSlider";

export const metadata: Metadata = {
  title: "The Club — Coming soon",
  description: "The Club — an endless strip from Zuhayr Creative's archive. Coming soon.",
  // A placeholder: keep it out of search results until the real page is back.
  robots: { index: false, follow: true },
};

/**
 * The Club — "coming soon" (client, 18 Nov: "change the club page 404 not
 * found to coming soon"). Until then the route called `notFound()` and showed
 * the shared 404 page; now it is a page of its own that answers 200, styled
 * like app/not-found.tsx so the two still read as one family.
 *
 * The slider that was here (ClubSlider) stays in the tree, unmounted. To
 * bring it back, restore the two imports above and return this instead:
 *
 *   <>
 *     <UnicornBackground />
 *     <main className="relative w-full max-w-full overflow-x-hidden">
 *       <ClubSlider />
 *     </main>
 *   </>
 */
export default function ClubPage() {
  return (
    <main
      className="relative flex min-h-svh w-full flex-col items-center justify-center gap-6 overflow-hidden px-6 text-center"
      style={{
        background:
          "radial-gradient(125% 125% at 50% 0%, #2a0a12 0%, #0a0a0a 60%)",
      }}
    >
      <span className="text-xs uppercase tracking-[0.3em] text-white/50 sm:text-sm">
        The Club
      </span>
      <h1
        className="font-display uppercase leading-[1.05] text-[clamp(3.5rem,14vw,11rem)]"
        style={{ color: "#C4010D" }}
      >
        Coming soon
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-white/60 sm:text-base">
        We&apos;re putting the finishing touches on this one. Check back soon.
      </p>
      <Link
        href="/"
        className="group mt-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.18em] text-white transition-colors hover:border-[#C4010D] hover:bg-[#C4010D]/15"
      >
        Back to home
        <span
          aria-hidden
          className="transition-transform duration-300 ease-out group-hover:translate-x-1"
        >
          &rarr;
        </span>
      </Link>
    </main>
  );
}
