"use client";

import { useEffect, useRef, useState } from "react";
import { hasGPU } from "@/app/lib/gpu";

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

interface NotebookView {
  destroy(): void;
}
interface NotebookModule {
  mountNotebook(
    el: HTMLElement,
    props?: {
      pages?: number;
      start?: "closed" | "open";
      background?: string;
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
    const url = `${BASE}notebook-viewer.js`;
    const loading = import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ url
    ) as Promise<NotebookModule>;
    loading.catch(() => undefined);
    const mount = () => {
      loading
        .then((mod) => {
          if (cancelled || view) return;
          view = mod.mountNotebook(host, {
            start: "closed",
            background: "transparent",
          });
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
