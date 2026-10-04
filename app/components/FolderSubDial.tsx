"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { subscribeGlassFile } from "./ChromaticMetal";
import { SUBFOLDERS, type Stamp } from "./dockFolders";
import "@/app/styles/folder-sub-dial.css";

/**
 * The glass folder's own dial — a second layer of the + dial (client, 3–4
 * Oct): "clicking on the glass folder needs to take the user away from the +
 * dial into a new sub dial from the glass folder that has the 3 sub folder so
 * that the whole thing can be bigger", and, on the first attempt, which was a
 * panel: "it's not suppose to be a pop up window ... another layer of sub
 * radial dial style menu like the + with the folders stacked".
 *
 * So it is built the way the + dial is: a hub in the corner, where the +
 * sits, and spokes around it. The + dial closes; the glass folder, large,
 * takes the +'s place as the hub, and the three subfolders spring out of it
 * — stacked in it first, then out — onto the + dial's phone arc: left,
 * diagonal, top (the desktop arc reaches right of the +, which would put big
 * folders off the screen). Each subfolder is the size the client asked for,
 * well over twice the + dial's buttons.
 *
 * Open a subfolder and its front swings open and its stamps slide further out
 * along its spoke, fanned; click a stamp and it expands to the centre of the
 * screen, as the site's other clickable images do. The hub goes back to the +
 * dial; Escape or a click anywhere else closes the dial.
 */

/**
 * The spokes' directions, from the hub: left, diagonal, top — each tilted a
 * few degrees in from the screen's edge, so a folder on the left spoke keeps
 * clear of the bottom edge and one on the top spoke clear of the right, with
 * the reach (see the CSS) set so neighbours never touch.
 */
const SPOKES = [172, 133, 95].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.cos(a), y: -Math.sin(a) };
});

/** The hub's canvas, CSS px: the face-on file fills about 60% of it. */
const HUB_PX = 132;
const HUB_PX_PHONE = 104;

interface Props {
  open: boolean;
  /** Back to the + dial. */
  onBack: () => void;
  /** Closed altogether. */
  onClose: () => void;
}

export default function FolderSubDial({ open, onBack, onClose }: Props) {
  // Kept mounted a beat after closing, so the folders can go back in.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [folder, setFolder] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ stamp: Stamp; from: DOMRect } | null>(null);

  // Opening mounts it, every opening starts with the folders shut, and
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
  // Shown a frame after mounting, so the spring-out has a start to run from;
  // unmounted once the folders are back in.
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    const t = window.setTimeout(() => setMounted(false), 460);
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

  // The hub: the same 3D glass file the dock's folder is, drawn from the
  // shared WebGL tile at this size, tipping open while a subfolder is open.
  // The file's state is shared with the dock's copy, so it is re-asserted on
  // every frame drawn: the dock, closing as this opens, sends its own file
  // flat once, and must not win.
  const hubRef = useRef<HTMLCanvasElement>(null);
  const hubWrapRef = useRef<HTMLButtonElement>(null);
  const fileOpen = useRef(0);
  useEffect(() => {
    fileOpen.current = folder !== null ? 1 : 0;
  }, [folder]);
  useEffect(() => {
    const canvas = hubRef.current;
    if (!mounted || !canvas) return;
    const phone = () => window.matchMedia("(max-width: 600px)").matches;
    let glass: ReturnType<typeof subscribeGlassFile> = null;
    glass = subscribeGlassFile(
      canvas,
      () => (phone() ? HUB_PX_PHONE : HUB_PX) * Math.min(window.devicePixelRatio || 1, 2),
      () => glass?.set({ form: 1, open: fileOpen.current, x: 0, y: 0 }),
    );
    // Without WebGL a flat glass envelope stands in (see .fsd-hub[data-glass]).
    if (hubWrapRef.current) hubWrapRef.current.dataset.glass = glass ? "1" : "0";
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
      {/* A click anywhere off the dial closes it. */}
      <div className={`fsd-scrim${shown ? " is-shown" : ""}`} aria-hidden onClick={onClose} />
      <div
        className={`fsd${shown ? " is-shown" : ""}${folder !== null ? " has-open" : ""}`}
        role="dialog"
        aria-label="Folders"
      >
        {/* The spokes: the subfolders on the arc round the hub. */}
        {SUBFOLDERS.map((f, i) => {
          const s = SPOKES[i % SPOKES.length];
          const isOpen = folder === i;
          return (
            <div
              key={f.name}
              className={`fsd-folder${isOpen ? " is-open" : ""}`}
              style={
                {
                  "--tint": f.tint,
                  "--edge": f.edge,
                  "--ux": s.x,
                  "--uy": s.y,
                  "--in": `${i * 0.06}s`,
                  "--outd": `${(SUBFOLDERS.length - 1 - i) * 0.04}s`,
                  "--z": isOpen ? 10 : 3 - i,
                } as React.CSSProperties
              }
            >
              <button
                type="button"
                className="fsd-folder-hit"
                aria-label={`${f.name} folder`}
                aria-expanded={isOpen}
                tabIndex={shown ? 0 : -1}
                onClick={() => setFolder((o) => (o === i ? null : i))}
              />
              <span className="fsd-folder-back" aria-hidden />
              {f.stamps.map((st, j) => {
                const k = j - (f.stamps.length - 1) / 2; // -0.5, 0.5 for two
                return (
                  <button
                    key={j}
                    type="button"
                    className="fsd-stamp"
                    aria-label={`Enlarge the ${st.label} stamp`}
                    tabIndex={isOpen ? 0 : -1}
                    style={
                      {
                        "--stamp-art": `url("${st.art}")`,
                        "--paper": st.paper ?? "#f4efe3",
                        "--k": k,
                        "--sdelay": `${0.08 + j * 0.06}s`,
                      } as React.CSSProperties
                    }
                    onClick={(e) => {
                      if (!isOpen) return;
                      setZoom({ stamp: st, from: e.currentTarget.getBoundingClientRect() });
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

        {/* The hub: the glass folder, where the + sits. Back to the + dial. */}
        <button
          ref={hubWrapRef}
          type="button"
          className="fsd-hub"
          aria-label="Back to quick actions"
          tabIndex={shown ? 0 : -1}
          onClick={onBack}
        >
          <canvas ref={hubRef} className="fsd-hub-canvas" width={1} height={1} aria-hidden />
          <span className="fsd-hub-flat liquid-glass" aria-hidden />
        </button>
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
