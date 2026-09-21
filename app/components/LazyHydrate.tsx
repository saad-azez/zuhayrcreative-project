"use client";

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLocomotiveScroll } from "./LocomotiveScrollProvider";
import { prefetchWhenIdle } from "@/app/animations/hooks/useNearViewport";
import {
  hasDormantSections,
  mountAllSections,
  registerDormant,
  trackMount,
} from "@/app/lib/lazySections";

gsap.registerPlugin(ScrollTrigger);

/**
 * Keep a section's server-rendered HTML on the page, but do not hydrate it —
 * do not even fetch its code — until the reader is on the way to it.
 *
 * Why. Every section on the home page used to be rendered a second time by
 * React at hydration, whether or not the reader would ever scroll to it, and
 * that render was the single biggest task on a phone's first load: the
 * gallery's forty ScrollTriggers, the impact section's split headlines, the
 * work strip's plates, all measured and built while the curtain was still
 * down. The text stays in the HTML (it is what search engines index, and it
 * is what the reader would see with no JavaScript at all); only the WORK of
 * making it live is moved to the moment it is about to be looked at.
 *
 * How. On the server this renders `server` — the same component, through
 * React.lazy so its module is not part of the first-load bundle. On the
 * client it renders an element with `dangerouslySetInnerHTML` set to nothing:
 * React hydrates such an element without touching what is inside it, so the
 * server's markup stays exactly as it arrived. When it is time, `load()`
 * brings the module in and the component is rendered in its place; React
 * clears the old markup and appends the new in one commit, so there is no
 * frame in which the section is missing.
 *
 * When is "time":
 *  - the section is within `margin` of the viewport AND the curtain is off
 *    (`app:uncovered`), then a moment of quiet (requestIdleCallback, capped
 *    at 700ms) — the same rule the globe follows. Nothing is built while the
 *    hero's entrance is playing.
 *  - the page was opened with a hash: everything mounts at once, because the
 *    provider scrolls to that id 150ms after it is ready and needs the final
 *    layout, not the server's.
 *  - a nav jump (`app:scroll-to`): the event is held, every dormant section
 *    is mounted, and the event is re-dispatched once they have settled — a
 *    section that grows on mount (the gallery sets its own height on phones)
 *    would otherwise move the target while Lenis is on its way there.
 *  - a client-side navigation to this page: there is no server markup to
 *    keep, so mount immediately.
 *
 * After every mount, ScrollTrigger and Lenis are refreshed: nothing else in
 * the app does that for a section that appears late (the provider's own
 * children-watcher only fires when its `children` prop changes).
 *
 * The wrapper is `display: contents`, so the section's box is what it always
 * was; the observer watches the server's child elements, which do have boxes.
 */

type Loaded = { default: ComponentType };

type Props = {
  /** `() => import("./TheSection")` — called once, on the client, when it is time. */
  load: () => Promise<Loaded>;
  /** The server's render: the same component, through `React.lazy` of the same import. */
  server: ReactNode;
  /** How far ahead of the viewport to arm. */
  margin?: string;
};

const CONTENTS = { display: "contents" } as const;
/**
 * ONE object for the lifetime of the module, never a literal in render:
 * React 19 re-applies `dangerouslySetInnerHTML` whenever the prop's identity
 * changes, and a fresh `{ __html: "" }` on every render of the page (the
 * reveal re-renders it, so does a route transition) wrote an empty string
 * into the element — wiping the server's markup, and with it the children
 * the observer was watching, so the section never mounted at all.
 */
const KEEP_SERVER_MARKUP = { __html: "" };

let jumpGuardInstalled = false;
function installJumpGuard() {
  if (jumpGuardInstalled || typeof window === "undefined") return;
  jumpGuardInstalled = true;
  window.addEventListener(
    "app:scroll-to",
    (e) => {
      if (!hasDormantSections()) return;
      // Hold this one; the same event goes out again once the page is whole.
      e.stopImmediatePropagation();
      const detail = (e as CustomEvent).detail;
      void mountAllSections().then(() => {
        window.dispatchEvent(new CustomEvent("app:scroll-to", { detail }));
      });
    },
    // Capture, so it runs before the provider's listener (and ahead of any
    // section that swallows the event while expanded).
    true,
  );
}

function scheduleIdle(cb: () => void, timeout: number): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(cb, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, timeout);
  return () => window.clearTimeout(id);
}

export default function LazyHydrate({
  load,
  server,
  margin = "150% 0px 150% 0px",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [Comp, setComp] = useState<ComponentType | null>(null);
  const { update } = useLocomotiveScroll();
  // The loader is written inline in JSX, so its identity changes with every
  // render of the page; the effect must not re-arm for that.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  /** Resolves the nav-jump guard's wait once this section has mounted and refreshed. */
  const settledRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (Comp) return;
    const host = ref.current;
    if (!host) return;
    installJumpGuard();

    let cancelled = false;
    let modulePromise: Promise<Loaded> | null = null;
    const fetchModule = () =>
      (modulePromise ??= loadRef.current().catch((err) => {
        modulePromise = null;
        throw err;
      }));

    const mount = () => {
      const p = new Promise<void>((resolve) => {
        if (cancelled) return resolve();
        // Asked twice (approach and a nav jump, say): both waits must end.
        const prev = settledRef.current;
        settledRef.current = () => {
          prev?.();
          resolve();
        };
        fetchModule().then(
          (m) => {
            if (cancelled) return resolve();
            setComp(() => m.default);
          },
          () => resolve(),
        );
      });
      trackMount(p);
      return p;
    };

    // Client-side navigation: nothing from the server to keep. A hash: the
    // provider will scroll to it as soon as it is ready and needs final offsets.
    if (host.childElementCount === 0 || window.location.hash) {
      void mount();
      return () => {
        cancelled = true;
      };
    }

    const unregister = registerDormant(mount);
    const stopPrefetch = prefetchWhenIdle(fetchModule);

    let near = false;
    let uncovered = Boolean((window as Window & { __appUncovered?: boolean }).__appUncovered);
    let cancelIdle: (() => void) | null = null;
    const maybeArm = () => {
      if (!near || !uncovered || cancelIdle || cancelled) return;
      cancelIdle = scheduleIdle(() => {
        unregister();
        void mount();
      }, 700);
    };

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") {
      near = true;
    } else {
      io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          near = true;
          io?.disconnect();
          maybeArm();
        },
        { rootMargin: margin },
      );
      for (const child of Array.from(host.children)) io.observe(child);
    }

    const onUncovered = () => {
      uncovered = true;
      maybeArm();
    };
    if (uncovered) maybeArm();
    else window.addEventListener("app:uncovered", onUncovered, { once: true });

    return () => {
      cancelled = true;
      unregister();
      io?.disconnect();
      cancelIdle?.();
      stopPrefetch();
      window.removeEventListener("app:uncovered", onUncovered);
    };
  }, [Comp, margin]);

  // The section's own effects have run by now (a child's effects fire before
  // its parent's). Give the page one frame to lay it out, then tell the scroll
  // machinery the document changed under it.
  useEffect(() => {
    if (!Comp) return;
    const raf = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      update();
      settledRef.current?.();
      settledRef.current = null;
    });
    return () => cancelAnimationFrame(raf);
  }, [Comp, update]);

  if (typeof window === "undefined") {
    return (
      <div style={CONTENTS}>
        <Suspense fallback={null}>{server}</Suspense>
      </div>
    );
  }
  if (Comp) {
    return (
      <div ref={ref} style={CONTENTS}>
        <Comp />
      </div>
    );
  }
  return (
    <div
      ref={ref}
      style={CONTENTS}
      suppressHydrationWarning
      dangerouslySetInnerHTML={KEEP_SERVER_MARKUP}
    />
  );
}
