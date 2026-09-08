"use client";

import { useEffect, useRef } from "react";
import "@/app/styles/email-planes.css";

/**
 * Five, counted off the reference clip frame by frame — not a guess. An earlier
 * version flew nine, then twenty, on the reasoning that a bigger ring needs a
 * denser flock; the reference simply uses five, and the sparseness is part of
 * how it reads.
 */
const PLANE_COUNT = 5;

/**
 * A folded paper dart, drawn as two facets sharing a keel — the lit wing and
 * the shaded one. That single darker facet is what makes it read as folded
 * paper rather than as a flat arrow glyph.
 */
function PaperPlane() {
  // 28x12 viewBox — a 2.33:1 dart, nose pointing along +X.
  //
  // The proportion is measured, not chosen: at the top and bottom of the
  // reference's orbit, where a plane is seen broadside at full length, its ink
  // measures 28x12. An earlier dart here was 1.46:1, and being that stubby it
  // barely changed width as it turned, which flattened the foreshortening to
  // 1.25 against the reference's 1.57. A slender dart is what makes the turn
  // legible.
  return (
    <svg viewBox="0 0 28 12" aria-hidden focusable="false">
      <path className="email-planes__wing-far" d="M27 6 1 1l8 5z" />
      <path className="email-planes__wing-near" d="M27 6 9 6l-8 5z" />
      <path className="email-planes__keel" d="M27 6 9 6" />
    </svg>
  );
}

/**
 * Paper planes for the footer email address.
 *
 * Desktop: the reference flock — five planes orbiting a ring laid back 51deg
 * from the camera, with the address in the middle of it. The planes lie IN the
 * ring's plane and fly nose-first, so they foreshorten from broadside at the
 * top and bottom of the orbit to nose-on at the sides. Each carries its own
 * shadow, the same silhouette dropped along the ring's normal. All of the
 * geometry lives in the stylesheet, measured off the clip; see the header there
 * for the numbers and how they were obtained.
 *
 * Mobile / tablet (below 1024px): no ring. The footer's contact cells are
 * narrower than the 310px orbit there, so one plane crosses left to right
 * above the address in a simple repeating enter/exit pass instead. Which one
 * runs is a CSS media query, not device detection — what decides is how much
 * horizontal room the address has, and that is a width question. Both markups
 * render and one is hidden, so no hydration flash.
 *
 * One trigger for every input: the animation plays on its own whenever the
 * footer's email block is on screen, and is PAUSED the rest of the time. It
 * used to be a hover reveal on pointer devices, which had two problems: the
 * flock was invisible to anyone who never happened to hover the address, and
 * testing a phone width in a desktop browser (hover still exists there)
 * showed a dead animation. The visibility gate is the optimization — looping
 * 3D transforms left running for the whole page would keep the compositor
 * busy behind every section above, so nothing animates until the visitor has
 * actually reached the footer.
 */
export default function EmailPlanes() {
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      ([entry]) => el.classList.toggle("is-flying", entry.isIntersecting),
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span
      ref={rootRef}
      className="email-planes"
      aria-hidden
      // The seats space themselves by dividing the loop by the count, so the
      // stylesheet has to know it.
      style={{ "--n": PLANE_COUNT } as React.CSSProperties}
    >
      {/* ── Desktop: the orbiting flock ── */}
      <span className="email-planes__ring">
        {Array.from({ length: PLANE_COUNT }, (_, i) => (
          <span
            key={i}
            className="email-planes__seat"
            style={{ "--i": i } as React.CSSProperties}
          >
            {/* Nose-first along the orbit; plane and shadow share the pose. */}
            <span className="email-planes__craft">
              <span className="email-planes__shadow">
                <PaperPlane />
              </span>
              <span className="email-planes__plane">
                <PaperPlane />
              </span>
            </span>
          </span>
        ))}
      </span>

      {/* ── Mobile: one plane, left to right, repeating ── */}
      <span className="email-planes__flyby">
        <span className="email-planes__plane">
          <PaperPlane />
        </span>
      </span>
    </span>
  );
}
