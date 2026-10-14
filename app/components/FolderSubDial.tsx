"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTransitionRouter } from "next-transition-router";
import { subscribeGlassFile } from "./ChromaticMetal";
import { useSplashHover } from "./useSplashHover";
import { SUBFOLDERS, type Stamp } from "./dockFolders";
import { LiquidField } from "./liquidField";
import { traceGlass } from "./glassTrace";
import FolderStack from "./FolderStack";
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
 * the reach (see the CSS) short enough that neighbours overlap a little,
 * stacked close and tight round the hub (client, 5 Oct).
 */
const SPOKES = [168, 132, 97].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.cos(a), y: -Math.sin(a) };
});

/** The hub's canvas, CSS px: the face-on file fills about 60% of it. */
const HUB_PX = 132;
const HUB_PX_PHONE = 104;

/**
 * How long the subfolders take to go back into the hub (their 0.32s ease
 * plus the stagger), and then the hub's own trip — out of the dock's folder
 * on the way in, back to it (or into the +) on the way out.
 */
const FOLDERS_IN_MS = 400;
const HUB_TRIP_MS = 460;
/** The subfolders wait for the hub to arrive before springing out of it. */
const FOLDERS_LEAD_S = 0.36;

export type SubDialExit = "back" | "close";

interface Props {
  open: boolean;
  /**
   * Where the dock's glass folder stands on screen. The hub IS that folder
   * (client, 8 Oct: "we are repeating two instances of the folder ... make
   * sure it's one and looks seamless"): it starts exactly there, at that
   * size — the same 3D file from the same shared tile, under the same
   * frost — so the hand-over cannot be seen, and travels to the corner.
   */
  from: DOMRect | null;
  /** Where the dock's folder stands now, to go back to. */
  home: () => DOMRect | null;
  /** The exit has begun (the dock starts closing on a close). */
  onLeaving: (kind: SubDialExit) => void;
  /** Back to the + dial: called once the hub is back on the dock's folder. */
  onBack: () => void;
  /** Closed altogether: called once the hub has gone into the +. */
  onClose: () => void;
}

export default function FolderSubDial({ open, from, home, onLeaving, onBack, onClose }: Props) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const [folder, setFolder] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ stamp: Stamp; from: DOMRect } | null>(null);
  const leaving = useRef<SubDialExit | null>(null);
  // For the things in a folder that are a way to a page (the notebook).
  // The site's own router, not Next's: a link goes through the block
  // transition every other page change plays (PageTransition), where Next's
  // router.push skipped it and the new page opened on its intro (client,
  // 15 Oct: "after clicking on the notebook … it plays the intro again").
  const router = useTransitionRouter();
  const pathname = usePathname();
  // The exit is still playing: it stays mounted until its own end, even once
  // the dock has been told (on a close the + surfaces under the hub as the
  // hub draws into it).
  const [exiting, setExiting] = useState(false);

  // Opening mounts it with the folders shut; closing unmounts it unless its
  // exit is still playing (see leave).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open || !exiting) setMounted(open);
    if (open) {
      setShown(false);
      setFolder(null);
      setZoom(null);
    }
  }

  const fsdRef = useRef<HTMLDivElement>(null);
  const hubWrapRef = useRef<HTMLButtonElement>(null);
  const hubRef = useRef<HTMLCanvasElement>(null);
  const hubFrostRef = useRef<HTMLSpanElement>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  /** The hub's transform that lays it over `r` (the hub's home is the anchor). */
  const over = (r: DOMRect | null) => {
    const anchor = fsdRef.current?.getBoundingClientRect();
    const size = hubWrapRef.current?.offsetWidth;
    if (!r || !anchor || !size) return "scale(0.4)";
    const dx = r.left + r.width / 2 - anchor.left;
    const dy = r.top + r.height / 2 - anchor.top;
    return `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${(r.width / size).toFixed(4)})`;
  };
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // In: the hub laid over the dock's folder before the first paint, then,
  // a frame later, on its way to the corner while the subfolders wait for
  // it (FOLDERS_LEAD_S) and spring out of it.
  useLayoutEffect(() => {
    const hub = hubWrapRef.current;
    if (!open || !mounted || !hub) return;
    leaving.current = null;
    hub.style.transition = "none";
    hub.style.transform = over(from);
    for (const el of [hubRef.current, hubFrostRef.current]) {
      if (el) {
        el.style.transition = "none";
        el.style.opacity = "1";
      }
    }
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        hub.style.transition = reduced()
          ? "none"
          : `transform ${HUB_TRIP_MS}ms cubic-bezier(0.3, 1.18, 0.5, 1)`;
        hub.style.transform = "none";
        setShown(true);
      });
    });
    return () => cancelAnimationFrame(raf);
    // `from` is read once, as the dial opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted]);

  // Out: the subfolders go back into the hub first, then the hub travels —
  // back onto the dock's folder, and only then is the dock told, so it shows
  // itself again round the folder standing exactly where the hub ends; or,
  // closing, into the + it came from, with the dock told as it sets off so
  // the + surfaces under it as it draws in.
  const leave = (kind: SubDialExit) => {
    if (leaving.current) return;
    leaving.current = kind;
    setExiting(true);
    setShown(false);
    setFolder(null);
    setZoom(null);
    onLeaving(kind);
    const hub = hubWrapRef.current;
    const still = reduced();
    const t1 = still ? 0 : FOLDERS_IN_MS;
    const t2 = still ? 0 : HUB_TRIP_MS;
    const end = () => {
      setExiting(false);
      setMounted(false);
    };
    timers.current.push(
      window.setTimeout(() => {
        if (!hub) return;
        hub.style.transition = still ? "none" : `transform ${t2}ms cubic-bezier(0.5, 0, 0.3, 1)`;
        if (kind === "back") {
          hub.style.transform = over(home());
          return;
        }
        // Into the +: it draws in to the +'s size, and comes down onto it
        // from where the dial stands, which on a desktop is a little above
        // the + (--fsd-lift, folder-sub-dial.css). Its glass and frost fade,
        // not the hub: an opacity on the hub would cut the frost off from
        // the page.
        const lift = fsdRef.current
          ? parseFloat(getComputedStyle(fsdRef.current).getPropertyValue("--fsd-lift")) || 0
          : 0;
        hub.style.transform = `translate(0, ${lift}px) scale(0.34)`;
        for (const el of [hubRef.current, hubFrostRef.current]) {
          if (el) {
            el.style.transition = still ? "none" : `opacity ${t2}ms ease`;
            el.style.opacity = "0";
          }
        }
      }, t1),
      // The dock, closing since the exit began, has its + back in the corner
      // by about half-way through the draw-in: shown any sooner, the + would
      // surface beside the hub, still gliding home.
      window.setTimeout(() => {
        if (kind === "close") onClose();
      }, t1 + t2 * 0.55),
      window.setTimeout(() => {
        if (kind === "back") onBack();
        end();
      }, t1 + t2),
    );
  };
  const leaveRef = useRef(leave);
  useLayoutEffect(() => {
    leaveRef.current = leave;
  });

  // Escape: the enlarged stamp first, then an open subfolder, then the dial.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (zoom) setZoom(null);
      else if (folder !== null) setFolder(null);
      else leaveRef.current("close");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, zoom, folder]);

  // The hub: the same 3D glass file the dock's folder is, drawn from the
  // shared WebGL tile at this size, under the same frost (traced from it as
  // the dock's is), tipping open while a subfolder is open. The file's state
  // is shared with the dock's copy, so it is re-asserted on every frame
  // drawn. A layout effect: the hub must not paint one empty frame over the
  // folder it is replacing.
  const fileOpen = useRef(0);
  useEffect(() => {
    fileOpen.current = folder !== null ? 1 : 0;
  }, [folder]);
  useLayoutEffect(() => {
    const canvas = hubRef.current;
    if (!mounted || !canvas) return;
    const phone = () => window.matchMedia("(max-width: 600px)").matches;
    const cssPx = () => (phone() ? HUB_PX_PHONE : HUB_PX);
    let tracer: LiquidField | null = null;
    let glass: ReturnType<typeof subscribeGlassFile> = null;
    glass = subscribeGlassFile(
      canvas,
      () => cssPx() * Math.min(window.devicePixelRatio || 1, 2),
      (ctx, px) => {
        glass?.set({ form: 1, open: fileOpen.current, x: 0, y: 0 });
        const css = cssPx();
        if (!tracer || tracer.width !== css) tracer = new LiquidField(css, css, 1);
        const d = traceGlass(tracer, ctx, px, css);
        if (hubFrostRef.current) {
          hubFrostRef.current.style.clipPath = d ? `path("${d}")` : 'path("M-9 -9Z")';
        }
      },
    );
    // Without WebGL a flat glass envelope stands in (see .fsd-hub[data-glass]).
    if (hubWrapRef.current) hubWrapRef.current.dataset.glass = glass ? "1" : "0";
    if (!glass) return;
    glass.set({ form: 1, open: fileOpen.current });
    glass.setActive(true);
    return () => {
      // Back in the dock the file stays formed — the dock's folder is it
      // now; gone into the +, it goes flat, as the dock's closing expects.
      glass?.set(leaving.current === "back" ? { open: 0 } : { form: 0, open: 0 });
      glass?.setActive(false);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <>
      {/* A click anywhere off the dial closes it. */}
      <div className={`fsd-scrim${shown ? " is-shown" : ""}`} aria-hidden onClick={() => leave("close")} />
      <div
        ref={fsdRef}
        className={`fsd${shown ? " is-shown" : ""}${folder !== null ? " has-open" : ""}`}
        style={{ "--fsd-lead": `${FOLDERS_LEAD_S}s` } as React.CSSProperties}
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
                  ...(f.frost !== undefined ? { "--frost": `${f.frost}px` } : {}),
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
                    className={`fsd-stamp${st.bare ? " is-bare" : ""}${st.href ? " is-link" : ""}`}
                    aria-label={st.href ? `Open ${st.label}` : `Enlarge the ${st.label} stamp`}
                    tabIndex={isOpen ? 0 : -1}
                    style={
                      {
                        "--stamp-art": `url("${st.artLarge ?? st.art}")`,
                        "--paper": st.paper ?? "#f4efe3",
                        "--k": k,
                        "--sdelay": `${0.08 + j * 0.06}s`,
                      } as React.CSSProperties
                    }
                    onClick={(e) => {
                      if (!isOpen) return;
                      if (st.href) {
                        // To its page, the dial folding away behind it (and
                        // only that, if this is already the page).
                        if (st.href !== pathname) router.push(st.href);
                        leave("close");
                        return;
                      }
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
          onClick={() => leave("back")}
        >
          <span ref={hubFrostRef} className="fsd-hub-frost" aria-hidden />
          {/* The dock folder's stack of coloured folders, at the hub's size,
              so the hand-over carries it; it gives way as the subfolders
              spring out of the hub. */}
          <FolderStack className="fsd-hub-stack" />
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
  // The wave every enlarged image on the site has, by mouse or by touch. It
  // ripples an <img>, so the art is one here rather than a background.
  useSplashHover(cardRef, true, true);

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
        style={{ "--paper": stamp.paper ?? "#f4efe3" } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="fsd-paper fsd-zoom-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="fsd-zoom-art" src={stamp.artLarge ?? stamp.art} alt={stamp.label} draggable={false} />
        </span>
      </div>
    </div>,
    document.body,
  );
}
