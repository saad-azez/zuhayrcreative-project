import type { Metadata } from "next";
import UnicornBackground from "../components/UnicornBackground";
import NotebookEmbed from "../components/NotebookEmbed";
import NotesIntro from "../components/NotesIntro";

export const metadata: Metadata = {
  title: "Notes",
  description: "Notes — the Zuhayr Creative notebook. Open it and turn the pages.",
};

/**
 * Notes.
 *
 * The page is the notebook (client, 12 Oct: "add a new page named notes and
 * put the notebook there"). The navbar and the footer come from
 * app/template.tsx, as on every route.
 *
 * The book does not take the whole screen. Its viewer keeps the mouse wheel
 * for turning pages, so a stage as tall as the viewport would leave a desktop
 * reader no way to wheel down to the footer; the heading's band above it is
 * page, and scrolls.
 */
export default function NotesPage() {
  return (
    <>
      {/* Shared Unicorn Studio WebGL background — the same fixed scene as the
          landing page (z -10). The viewer is transparent over it. */}
      <UnicornBackground />
      <main className="relative w-full max-w-full overflow-x-hidden">
        <section
          aria-label="Notes"
          className="relative flex min-h-dvh w-full flex-col"
        >
          {/* Above the notebook's canvas, which runs on up behind it: a
              wheel here scrolls the page rather than turning a leaf. */}
          <div className="relative z-10 px-6 pt-24 md:px-12 md:pt-28">
            <h1
              className="text-[clamp(2.5rem,5vw,6rem)] font-medium uppercase leading-[0.95] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Notes
            </h1>
            <NotesIntro />
            <p
              className="mt-4 text-[0.7rem] uppercase tracking-[0.28em] text-white/70"
              style={{ fontFamily: "var(--font-hint)" }}
            >
              Click the book to open
            </p>
          </div>
          <NotebookEmbed className="relative min-h-[70dvh] w-full flex-1" />
        </section>
      </main>
    </>
  );
}
