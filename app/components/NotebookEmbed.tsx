"use client";

import { useEffect, useRef, useState } from "react";
import { hasGPU } from "@/app/lib/gpu";
import { readHeroVariant } from "@/app/lib/heroVariant";

/**
 * The 3D notebook (the client's read-only journal viewer), mounted into an
 * element of ours. It fills whatever box it is given.
 *
 * It is NOT part of this app's bundle. The viewer arrives prebuilt, with its
 * own copies of React and three inside it (its three is newer than this
 * site's, and its journal code is frozen against that version), so it is
 * served as static files from `public/notebook/` and imported at run time,
 * past the bundler. Its worker, its texture scans and its stylesheet are
 * fetched from the same folder.
 *
 * `public/notebook/` is not the export's `dist/` copied over: it is made
 * from it by `tools/prepare-notebook.mjs`, which has the reasons. In short,
 * the export carries its seventeen texture scans inside its scripts as text
 * (a 12 MB script and a 2.6 MB worker), and asks for its worker at the root
 * of the site. Prepared, the scans are files of their own: the book on
 * screen fetches the five it uses, about 3 MB with the code, where it used
 * to pull 10 MB before drawing anything. The pictures' bytes and the code
 * are otherwise untouched, and the tool proves that on every run. A fresh
 * export goes through the same tool.
 */
const BASE = "/notebook/";

/** Two spreads of the plain booklet (faces 5 to 8: the logo's journey, then more to come), drawn by
 *  tools/notebook-pages. The ones before are skipped: the kraft cover's pocket shows through the first, and a strip of it
 *  along the foot of the second. */
// After them the reader can go on to the two sleeves at the back and the
// back itself; the blank rest of the booklet goes over in one turn.
const SPAN = { section: "plain", from: 5, to: 8, then: ["sleeve", "red", "back"] } as const;
const firstSpreads = (booklet: string, page: number) =>
  booklet === "plain" && page >= SPAN.from && page <= SPAN.to ? `/notebook-pages/plain-${page - SPAN.from + 1}.webp` : null;

interface NotebookView {
  update(next: { bleedTop?: number }): void;
  destroy(): void;
}
interface NotebookModule {
  /** Paints the leather and papers ahead of mounting (a worker and idle time). */
  prewarm?(): void;
  mountNotebook(
    el: HTMLElement,
    props?: {
      pages?: number;
      start?: "closed" | "open";
      background?: string;
      content?: (booklet: string, page: number) => string | null;
      sections?: string[];
      span?: { section: string; from: number; to: number; then?: readonly string[] };
      closeUp?: boolean;
      inserts?: string[];
      bleedTop?: number;
      label?: boolean;
      scrubber?: boolean;
    },
  ): NotebookView;
}

export default function NotebookEmbed({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  // null while loading; a line of text takes the book's place if it cannot
  // be shown.
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let view: NotebookView | null = null;
    let watch: ResizeObserver | null = null;
    // The model draft: the canvas runs on up behind the heading above this
    // box, so a book tilted up by hand is not cut off at the box's top edge.
    const model = readHeroVariant() === "model";
    const section = host.closest("section");
    const bleed = () =>
      section ? Math.max(0, Math.round(host.getBoundingClientRect().top - section.getBoundingClientRect().top)) : 0;
    const fail = (why: string) => {
      if (!cancelled) setProblem(why);
    };

    if (!hasGPU()) {
      // Deferred a frame: this is a subscription to the browser, not state
      // derived in the effect.
      const raf = requestAnimationFrame(() =>
        fail("The notebook needs a graphics card to draw."),
      );
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }

    // Sent for at once, mounted when the loader's curtain is off. Mounted
    // under it, the viewer's start (its leather is painted from scans, its
    // scene compiled) was work on the same thread as the intro, and held the
    // curtain down a couple of seconds longer on this page than on any other.
    // In development the bundle is rebuilt in place (tools/prepare-notebook.mjs),
    // so it is asked for afresh on every load there: a reload never runs the
    // build before. Deployed, the address stays the same.
    const url = `${BASE}notebook-viewer.js${process.env.NODE_ENV === "development" ? `?t=${Date.now()}` : ""}`;
    const loading = import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ url
    ) as Promise<NotebookModule>;
    loading.catch(() => undefined);
    // The leather is painted while the curtain is still down: in a worker and
    // in the page's idle moments, so the intro does not feel it, and the book
    // is ready to draw the moment it is mounted. The two pages it opens on
    // are fetched now too, so they are there when it opens.
    loading
      .then((mod) => {
        if (cancelled) return;
        mod.prewarm?.();
        if (model) for (const n of [1, 2]) new Image().src = `/notebook-pages/plain-${n}.webp`;
      })
      .catch(() => undefined);
    const mount = () => {
      loading
        .then((mod) => {
          if (cancelled || view) return;
          view = mod.mountNotebook(host, {
            start: "closed",
            background: "transparent",
            // The logo's journey and a spread of more to come
            // (tools/notebook-pages): the book opens straight on them, close
            // enough to read, and turns between those two spreads only. The model draft only,
            // for now; everywhere else the book is as it was.
            ...(model
              ? { content: firstSpreads, pages: SPAN.to, span: SPAN, closeUp: true, sections: [], label: false, scrubber: false, inserts: ["plain", "sleeve", "red"], bleedTop: bleed() }
              : {}),
          });
          if (model && section) {
            watch = new ResizeObserver(() => view?.update({ bleedTop: bleed() }));
            watch.observe(section);
          }
        })
        .catch(() => fail("The notebook could not be loaded."));
    };
    if ((window as Window & { __appUncovered?: boolean }).__appUncovered) {
      mount();
    } else {
      window.addEventListener("app:uncovered", mount, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("app:uncovered", mount);
      watch?.disconnect();
      view?.destroy();
    };
  }, []);

  return (
    <>
      {/* React hoists this to the head and loads it once. */}
      <link
        rel="stylesheet"
        href={`${BASE}notebook-viewer.css`}
        precedence="default"
      />
      <div className={className}>
        {/* The viewer takes the wheel for its pages (and stops it there), so
            the smooth scroll is told to leave this box alone as well. */}
        {/* Pinned to the box, not sized by a percentage: the viewer is
            `height: 100%`, and against a box whose height comes from flex or
            a min-height that resolves to nothing — the canvas's default
            150px. `className` therefore has to make the box a positioned
            one. */}
        <div ref={hostRef} data-lenis-prevent className="absolute inset-0" />
        {problem && (
          <p
            className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-[0.7rem] uppercase tracking-[0.28em] text-white/60"
            style={{ fontFamily: "var(--font-hint)" }}
          >
            {problem}
          </p>
        )}
      </div>
    </>
  );
}
