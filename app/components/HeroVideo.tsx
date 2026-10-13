"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRevealGate } from "@/app/lib/revealGates";

gsap.registerPlugin(ScrollTrigger);

/**
 * The "moon walk" loop as the hero's background: the third of the three
 * backgrounds being compared (lib/heroVariant.ts; client, 13 Oct: "create
 * another variant of the hero section with it as the background … the text
 * and logo and all will be in the same place in all three"). A layer that
 * fills the hero, behind the headline, where HeroBackground and HeroShop sit
 * in the other two.
 *
 * The files are not the client's master (89 MB, 3840x2872) but copies made
 * from it by `tools/prepare-hero-video.mjs`, which has the reasons and the
 * sizes. In short: two shapes, the whole 4:3 frame and the part of it a
 * phone shows; each in AV1 and in H.264; and frame 0 of each as a still. A
 * visitor downloads one video, 1 to 6 MB.
 *
 * How it is laid out is in hero-banner.css (".hero-video"): it fills a
 * landscape hero, and in a phone's upright one it is a band across the
 * middle that shows two thirds of the picture's width, where filling the box
 * showed under a third (client, 14 Oct: "is it possible to better optimize
 * the size on phone so more of it can be seen?").
 *
 * Which file:
 *  - the shape, by the hero's own box. The narrow copy is exactly the part
 *    of the picture the band shows, so it is used where the band is, and
 *    there it is the same picture at the same framing as the wide one would
 *    be: a saving, never a different composition;
 *  - the codec, by asking the browser whether it decodes AV1 at this size
 *    smoothly AND in hardware. Otherwise H.264, which every device does. A
 *    video decoded in software is the one way this layer could cost frames,
 *    so the smaller file is only taken where it is free.
 *
 * What is on screen, in order:
 *  1. the still, from the server's HTML. The loader holds its curtain for it
 *     (a reveal gate), so the curtain lifts onto the picture, never onto the
 *     flat colour under it;
 *  2. the video, fetched while the curtain is still down and started when it
 *     is off, so the walk begins as the page is shown. It fades in over the
 *     still on its first frame, which is the same picture.
 *
 * The still is all there is for a visitor who has asked for less motion or to
 * save data, on a 2G connection, and wherever the browser will not start a
 * video by itself (an iPhone in Low Power Mode).
 *
 * It only plays while it can be seen: paused once the hero has left the
 * screen and while the tab is hidden.
 */
const BASE = "/hero/moon-walk";

/** The two shapes, as tools/prepare-hero-video.mjs makes them. */
const WIDE = { name: "wide", width: 1920, height: 1436, av1: "av01.0.12M.08", bitrate: 3_000_000 };
const NARROW = { name: "narrow", width: 954, height: 1080, av1: "av01.0.05M.08", bitrate: 1_000_000 };

/**
 * The hero's box is laid out as a band when it is at most this wide for its
 * height: the same number as the container query in hero-banner.css.
 */
const BAND_BELOW = 3 / 5;
/**
 * The narrow still, by the WINDOW's shape, which is all a <picture> can ask
 * about. The hero is at least as tall as the window, so a window this narrow
 * always has the band; a box that has the band under a slightly wider window
 * is given the wide still, which the band crops to the same picture.
 */
const NARROW_MEDIA = "(max-aspect-ratio: 9/16)";

async function pickSource(box: HTMLElement): Promise<string> {
  const { width, height } = box.getBoundingClientRect();
  const shape = width / height <= BAND_BELOW ? NARROW : WIDE;
  let av1 = false;
  try {
    const answer = await navigator.mediaCapabilities.decodingInfo({
      type: "file",
      video: {
        contentType: `video/mp4; codecs="${shape.av1}"`,
        width: shape.width,
        height: shape.height,
        bitrate: shape.bitrate,
        framerate: 30,
      },
    });
    av1 = answer.supported && answer.smooth && answer.powerEfficient;
  } catch {
    // No such API (old Safari), or it will not say: H.264.
  }
  return `${BASE}-${shape.name}${av1 ? ".av1" : ""}.mp4`;
}

/** Does this visitor get the moving picture, or the still? */
function videoPlays(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const link = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  return !(link?.saveData || /(^|-)2g$/.test(link?.effectiveType ?? ""));
}

export default function HeroVideo() {
  const boxRef = useRef<HTMLDivElement>(null);
  const stillRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // True from the video's first frame on screen; until then the still shows.
  const [playing, setPlaying] = useState(false);

  // The curtain waits for the still (or for it to fail: a picture that will
  // never arrive must not hold the page).
  const settleGate = useRevealGate("hero-video");
  useEffect(() => {
    const still = stillRef.current;
    if (!still) return settleGate();
    still.decode().then(settleGate, settleGate);
  }, [settleGate]);

  // Under this variant the hero is a little taller than under the others
  // (hero-banner.css), and it becomes this variant after the page has been
  // laid out as the default one. Anything that has already measured where
  // the sections are measures again.
  useEffect(() => {
    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    const video = videoRef.current;
    if (!box || !video || !videoPlays()) return;

    let cancelled = false;
    let uncovered = !!(window as Window & { __appUncovered?: boolean })
      .__appUncovered;
    let inView = true;

    const sync = () => {
      if (!video.getAttribute("src")) return;
      if (uncovered && inView && !document.hidden) {
        // Refused where the browser will not start a video unasked: the
        // still stays, which is the right thing to show.
        video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    };
    const onUncovered = () => {
      uncovered = true;
      sync();
    };
    const onPlaying = () => setPlaying(true);

    video.addEventListener("playing", onPlaying);
    window.addEventListener("app:uncovered", onUncovered);
    document.addEventListener("visibilitychange", sync);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    io.observe(box);

    pickSource(box).then((src) => {
      if (cancelled) return;
      // As a property too: React does not write `muted` into the markup, and
      // a video that is not muted is not allowed to start by itself.
      video.muted = true;
      video.src = src;
      sync();
    });

    return () => {
      cancelled = true;
      io.disconnect();
      video.removeEventListener("playing", onPlaying);
      window.removeEventListener("app:uncovered", onUncovered);
      document.removeEventListener("visibilitychange", sync);
      // Let go of the download and the decoder with the element.
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  return (
    <div
      ref={boxRef}
      data-hero-video
      aria-hidden
      className="hero-video absolute inset-0 overflow-hidden pointer-events-none"
      style={{
        // Behind all content, above the page-wide background: where the
        // hero's own scene sits (HeroBackground has why it is not 0).
        zIndex: -1,
        // The picture's own dark reds: under it until the still is in, and
        // what its band stands on in a phone's upright hero.
        background:
          "radial-gradient(120% 70% at 50% 50%, #3a0a16 0%, #1f070e 55%, #140509 100%)",
        // Where it tapers into the page's background is in hero-banner.css
        // (".hero-video"): below the first screen, not in it.
      }}
    >
      <picture>
        <source
          media={NARROW_MEDIA}
          type="image/avif"
          srcSet={`${BASE}-narrow.avif`}
        />
        <source media={NARROW_MEDIA} srcSet={`${BASE}-narrow.jpg`} />
        <source type="image/avif" srcSet={`${BASE}-wide.avif`} />
        <img
          ref={stillRef}
          src={`${BASE}-wide.jpg`}
          alt=""
          draggable={false}
          decoding="async"
          className="hero-video__frame"
        />
      </picture>
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
        className="hero-video__frame"
        style={{
          opacity: playing ? 1 : 0,
          transition: "opacity 400ms linear",
        }}
      />
    </div>
  );
}
