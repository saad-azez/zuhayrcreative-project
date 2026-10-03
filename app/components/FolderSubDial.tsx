"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { subscribeGlassFile } from "./ChromaticMetal";
import { SUBFOLDERS, type Stamp } from "./dockFolders";
import "@/app/styles/folder-sub-dial.css";

/**
 * The glass folder's own dial (client, 3 Oct): "clicking on the glass folder
 * needs to take the user away from the + dial into a new sub dial from the
 * glass folder that has the 3 sub folder so that the whole thing can be
 * bigger ... and be seen properly by the user right now its really small".
 *
 * The dock's + dial closes and this opens in the same corner: the glass file,
 * large, with its three subfolders lifted out of it and set side by side at a
 * size that reads. Click a subfolder and its front swings open and its stamps
 * slide up out of it; click a stamp and it expands to the centre of the
 * screen, the way every other clickable image on the site does. Back returns
 * to the + dial; ×, Escape or a click outside closes it.
 */

/** The big file's canvas, CSS px: the face-on file fills about 60% of it. */
const FILE_PX = 168;
const FILE_PX_PHONE = 116;

interface Props {
  open: boolean;
  /** Back to the + dial. */
  onBack: () => void;
  /** Closed altogether. */
  onClose: () => void;
}

export default function FolderSubDial({ open, onBack, onClose }: Props) {
  // Kept mounted a beat after closing, so the exit can play.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [folder, setFolder] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ stamp: Stamp; from: DOMRect } | null>(null);

  // Opening mounts it and every opening starts with the folders shut;
  // closing starts the exit (adjusted while rendering, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMounted(true);
    else {
      setShown(false);
      setFolder(null);
      setZoom(null);
    }
  }
  // Shown a frame after mounting, so the entrance has a start to run from;
  // unmounted once the exit has played.
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    const t = window.setTimeout(() => setMounted(false), 420);
    return () => window.clearTimeout(t);
  }, [open]);

  // Escape: the enlarged stamp first, then an open subfolder, then the dial.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (zoom) setZoom(null);
      else if (folder !== null) setFolder(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, zoom, folder, onClose]);

  // The big glass file: the same 3D file the dock's folder is, drawn from the
  // shared WebGL tile at this size. It tips open while a subfolder is open.
  // The file's state is shared with the dock's copy, so it is re-asserted on
  // every frame drawn: the dock, closing as this opens, sends its own file
  // flat once, and must not win.
  const fileRef = useRef<HTMLCanvasElement>(null);
  const fileWrapRef = useRef<HTMLDivElement>(null);
  const fileOpen = useRef(0);
  useEffect(() => {
    fileOpen.current = folder !== null ? 1 : 0;
  }, [folder]);
  useEffect(() => {
    const canvas = fileRef.current;
    if (!mounted || !canvas) return;
    const phone = () => window.matchMedia("(max-width: 600px)").matches;
    let glass: ReturnType<typeof subscribeGlassFile> = null;
    glass = subscribeGlassFile(
      canvas,
      () => (phone() ? FILE_PX_PHONE : FILE_PX) * Math.min(window.devicePixelRatio || 1, 2),
      () => glass?.set({ form: 1, open: fileOpen.current, x: 0, y: 0 }),
    );
    // Without WebGL the flat envelope stands in (see .fsd-file[data-glass]).
    if (fileWrapRef.current) fileWrapRef.current.dataset.glass = glass ? "1" : "0";
    if (!glass) return;
    glass.set({ form: 1, open: fileOpen.current });
    glass.setActive(true);
    return () => {
      glass?.set({ form: 0, open: 0 });
      glass?.setActive(false);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <>
      {/* A click anywhere outside the dial closes it. */}
      <div
        className={`fsd-scrim${shown ? " is-shown" : ""}`}
        aria-hidden
        onClick={onClose}
      />
      <div
        className={`fsd${shown ? " is-shown" : ""}${folder !== null ? " has-open" : ""}`}
        role="dialog"
        aria-label="Folders"
        data-lenis-prevent
      >
        <div className="fsd-bar">
          <button
            type="button"
            className="fsd-btn liquid-glass lg-drop lg-gulp"
            aria-label="Back"
            onClick={onBack}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="fsd-btn liquid-glass lg-drop lg-gulp"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="fsd-stage">
          {/* The subfolders, lifted out of the file one after the other and
              set side by side; the nearest to the file comes out first. */}
          <div className="fsd-folders">
            {SUBFOLDERS.map((f, i) => {
              const fromFile = SUBFOLDERS.length - i; // slots to the file
              const isOpen = folder === i;
              return (
                <div
                  key={f.name}
                  className={`fsd-folder${isOpen ? " is-open" : ""}`}
                  style={
                    {
                      "--tint": f.tint,
                      "--edge": f.edge,
                      "--from": fromFile,
                      "--delay": `${0.12 + (SUBFOLDERS.length - 1 - i) * 0.08}s`,
                    } as React.CSSProperties
                  }
                >
                  <button
                    type="button"
                    className="fsd-folder-hit"
                    aria-label={`${f.name} folder`}
                    aria-expanded={isOpen}
                    onClick={() => setFolder((o) => (o === i ? null : i))}
                  />
                  <span className="fsd-folder-back" aria-hidden />
                  {f.stamps.map((s, j) => {
                    const n = f.stamps.length;
                    const k = j - (n - 1) / 2; // -0.5, 0.5 for two
                    return (
                      <button
                        key={j}
                        type="button"
                        className="fsd-stamp"
                        aria-label={`Enlarge the ${s.label} stamp`}
                        tabIndex={isOpen ? 0 : -1}
                        style={
                          {
                            "--stamp-art": `url("${s.art}")`,
                            "--paper": s.paper ?? "#f4efe3",
                            "--k": k,
                            "--sdelay": `${0.06 + j * 0.06}s`,
                          } as React.CSSProperties
                        }
                        onClick={(e) => {
                          if (!isOpen) return;
                          setZoom({ stamp: s, from: e.currentTarget.getBoundingClientRect() });
                        }}
                      >
                        <span className="fsd-paper" aria-hidden>
                          <span className="fsd-art" />
                        </span>
                      </button>
                    );
                  })}
                  <span className="fsd-folder-front" aria-hidden>
                    <span className="fsd-folder-name">{f.name}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* The glass file they came out of. */}
          <div ref={fileWrapRef} className="fsd-file" aria-hidden>
            <canvas ref={fileRef} className="fsd-file-canvas" width={1} height={1} />
            <span className="fsd-file-flat liquid-glass" />
          </div>
        </div>
      </div>

      {zoom && <StampZoom stamp={zoom.stamp} from={zoom.from} onClose={() => setZoom(null)} />}
    </>
  );
}

/**
 * A stamp, enlarged: expands from where it was clicked to the centre of the
 * screen over a blurred backdrop — the site's enlarge-on-click, as in the
 * work gallery's orbit (OrbitingGallery). Closes on the ×, the backdrop or
 * Escape (handled by the dial).
 */
function StampZoom({ stamp, from, onClose }: { stamp: Stamp; from: DOMRect; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  // The page holds still under it, as under the gallery's.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    window.dispatchEvent(new Event("app:scroll-lock"));
    return () => {
      document.body.style.overflow = "";
      window.dispatchEvent(new Event("app:scroll-unlock"));
    };
  }, []);

  // FLIP: from the clicked stamp's box to the centred one.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const to = card.getBoundingClientRect();
    if (reduce || !to.width) {
      card.style.opacity = "1";
      setShown(true);
      return;
    }
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const s = from.width / to.width;
    card.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 1 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ],
      { duration: 460, easing: "cubic-bezier(0.22, 0.9, 0.3, 1.04)", fill: "both" },
    );
    setShown(true);
  }, [from]);

  return createPortal(
    <div
      className={`fsd-zoom${shown ? " is-shown" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${stamp.label} stamp`}
      data-lenis-prevent
      onClick={onClose}
    >
      <button
        type="button"
        className="fsd-zoom-close liquid-glass lg-drop lg-gulp"
        aria-label="Close"
        onClick={onClose}
      >
        ✕
      </button>
      <div
        ref={cardRef}
        className="fsd-zoom-card"
        style={{ "--stamp-art": `url("${stamp.art}")`, "--paper": stamp.paper ?? "#f4efe3" } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="fsd-paper fsd-zoom-paper">
          <span className="fsd-art" role="img" aria-label={stamp.label} />
        </span>
      </div>
    </div>,
    document.body,
  );
}
