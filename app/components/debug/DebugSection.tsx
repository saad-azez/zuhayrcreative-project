"use client";

import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from "react";
import {
  describe,
  dlog,
  isEnabled,
  markCrashed,
  measureMedia,
  now,
  registerSection,
  sectionRoots,
  setVisible,
  unionRect,
  unregisterSection,
} from "@/app/lib/mobileDebug";

/**
 * Wraps one section of the page for the mobile debug panel.
 *
 * Layout-neutral: the wrapper is `display: contents`, so it has no box of its
 * own — no containing block, no stacking context, nothing for sticky or fixed
 * children to notice — and it renders the same markup on the server and the
 * client whether debugging is on or not (so hydration never differs). All
 * the watching happens in an effect that only runs when debugging is on.
 *
 * It is also an error boundary: a section that throws while rendering takes
 * itself down, not the whole page. With debugging on, it leaves a red card
 * in its place naming the error; with it off, it leaves nothing.
 *
 * `overlay` marks fixed, full-screen layers (loader, navbar, dock, cursors)
 * whose on-screen state and overflow mean nothing — they are tracked for
 * mounting, canvases, WebGL and crashes only.
 */
export default function DebugSection({
  name,
  note,
  overlay = false,
  children,
}: {
  name: string;
  note?: string;
  overlay?: boolean;
  children: ReactNode;
}) {
  return (
    <SectionBoundary name={name}>
      <SectionWatch name={name} note={note} overlay={overlay}>
        {children}
      </SectionWatch>
    </SectionBoundary>
  );
}

function SectionWatch({
  name,
  note,
  overlay,
  children,
}: {
  name: string;
  note?: string;
  overlay: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = ref.current;
    if (!wrapper || !isEnabled()) return;
    const stat = registerSection(name, wrapper, { note, overlay });
    stat.mountedAt = now();
    if (stat.state !== "crashed") stat.state = "mounted";

    const roots = sectionRoots(wrapper);
    const u = unionRect(roots);
    const media = measureMedia(wrapper);
    dlog(
      "info",
      name,
      `Mounted at ${Math.round(stat.mountedAt)}ms${note ? ` (${note})` : ""} — ` +
        `${roots.length ? roots.map(describe).join(" + ") : "no element rendered yet"}, ` +
        `${Math.round(u.width)}×${Math.round(u.height)}px, ` +
        `${media.canvases} canvas (${media.canvasMB} MB), ${media.images} images, ${media.videos} videos.`,
    );

    const cleanups: (() => void)[] = [];

    // ── On/off screen ──
    if (!overlay) {
      const inView = new Set<Element>();
      let enteredAt = 0;
      let fpsAtEnter = { sum: 0, n: 0, long: 0 };
      const io = new IntersectionObserver((list) => {
        for (const e of list) {
          if (e.isIntersecting) inView.add(e.target);
          else inView.delete(e.target);
        }
        const on = inView.size > 0;
        if (on === stat.visibleNow) return;
        setVisible(name, on);
        const y = Math.round(window.scrollY);
        if (on) {
          enteredAt = now();
          fpsAtEnter = { sum: stat.fpsSum, n: stat.fpsN, long: stat.longFrames };
          const m = measureMedia(wrapper);
          const first = stat.firstVisibleAt === undefined;
          if (first) stat.firstVisibleAt = enteredAt;
          dlog(
            "info",
            name,
            `${first ? "FIRST came" : "Came"} on screen (scrollY ${y}) — ` +
              `${m.canvases} canvas holding ${m.canvasMB} MB, ${m.images} images decoded to ~${m.imageMB} MB.`,
            m.canvasList.length ? m.canvasList : undefined,
          );
        } else {
          const secs = (now() - enteredAt) / 1000;
          const n = stat.fpsN - fpsAtEnter.n;
          const avg = n ? Math.round((stat.fpsSum - fpsAtEnter.sum) / n) : null;
          const long = stat.longFrames - fpsAtEnter.long;
          dlog(
            avg !== null && avg < 30 ? "perf" : "info",
            name,
            `Left the screen (scrollY ${y}) after ${secs.toFixed(1)}s — ` +
              `${avg !== null ? `averaged ${avg}fps` : "too short to measure fps"}, ${long} long frame(s) (>100ms) while on screen.`,
          );
        }
      });
      const observeAll = () => {
        io.disconnect();
        inView.clear();
        sectionRoots(wrapper).forEach((el) => io.observe(el));
      };
      observeAll();
      // A section that swaps its content (the lazy globe) gets new roots.
      const mo = new MutationObserver(() => observeAll());
      mo.observe(wrapper, { childList: true });
      cleanups.push(() => {
        io.disconnect();
        mo.disconnect();
      });

      // ── Big height changes: content collapsing or arriving late ──
      let lastH = Math.round(u.height);
      let lastLog = 0;
      const ro = new ResizeObserver(() => {
        const h = Math.round(unionRect(sectionRoots(wrapper)).height);
        const diff = Math.abs(h - lastH);
        if (diff > 150 && diff > lastH * 0.25 && now() - lastLog > 1500) {
          lastLog = now();
          dlog(
            "layout",
            name,
            `Height jumped ${lastH}px → ${h}px — everything below it moved by ${h - lastH}px (content collapsed, loaded late, or a 100vh changed with the address bar).`,
          );
          lastH = h;
        }
      });
      sectionRoots(wrapper).forEach((el) => ro.observe(el));
      cleanups.push(() => ro.disconnect());
    }

    return () => {
      cleanups.forEach((f) => f());
      dlog("info", name, "Unmounted.");
      unregisterSection(name);
    };
  }, [name, note, overlay]);

  return (
    <div ref={ref} data-debug-section={name} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

class SectionBoundary extends Component<
  { name: string; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    markCrashed(this.props.name);
    dlog(
      "error",
      this.props.name,
      `CRASHED while rendering: ${error.message}. The section was removed; the rest of the page kept running.`,
      `${error.stack?.split("\n").slice(0, 5).join("\n") ?? ""}\ncomponent stack:${info.componentStack?.split("\n").slice(0, 6).join("\n") ?? ""}`,
    );
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (!isEnabled()) return null;
    return (
      <div
        style={{
          margin: "16px",
          padding: "14px",
          border: "2px solid #ff3b4a",
          borderRadius: 8,
          background: "rgba(40,0,6,0.9)",
          color: "#ffd6da",
          font: "12px/1.4 ui-monospace, Menlo, monospace",
          position: "relative",
          zIndex: 5,
        }}
      >
        <b>⚠ {this.props.name} crashed</b>
        <div style={{ marginTop: 6, wordBreak: "break-word" }}>{error.message}</div>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          style={{
            marginTop: 10,
            padding: "6px 12px",
            background: "#ff3b4a",
            color: "#fff",
            border: 0,
            borderRadius: 6,
            font: "inherit",
          }}
        >
          Retry
        </button>
      </div>
    );
  }
}
