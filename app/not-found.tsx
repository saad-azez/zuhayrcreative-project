import Link from "next/link";

export const metadata = {
  title: "Page not found",
};

/**
 * Custom 404 / "coming soon" page. Shown for any route that doesn't exist yet,
 * and for menu destinations that aren't built (those pages call `notFound()`).
 */
export default function NotFound() {
  return (
    <main
      className="relative flex min-h-lvh w-full flex-col items-center justify-center gap-6 overflow-hidden px-6 text-center"
      style={{
        background:
          "radial-gradient(125% 125% at 50% 0%, #2a0a12 0%, #0a0a0a 60%)",
      }}
    >
      <span
        aria-hidden
        className="font-display uppercase leading-[1.25] text-[clamp(6rem,26vw,18rem)]"
        style={{ color: "#C4010D" }}
      >
        404
      </span>
      <h1 className="font-display uppercase tracking-wide text-[clamp(1.4rem,3.4vw,2.4rem)] text-white">
        Page not found
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-white/60 sm:text-base">
        This page isn&apos;t ready yet — it&apos;s coming soon. Let&apos;s get
        you back on track.
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
