"use client";

import { forwardRef, memo, useCallback, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { GalleryItem } from "./galleryData";
import { useScrollParallaxImage } from "./useScrollParallaxImage";
import { useTunnelReveal } from "./useTunnelReveal";
import { useSplashHover } from "../useSplashHover";
import { usePixelReveal } from "./usePixelReveal";
import { createPixelTextReveal } from "./pixelTextReveal";

gsap.registerPlugin(ScrollTrigger);

/* ── Types ── */

interface GalleryGridProps {
  items: GalleryItem[];
  onImageClick: (index: number, imageEl: HTMLElement) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isTouch: boolean;
  /** Wide screen (>= 1024px) — the breakpoint the section's lightbox uses. */
  isDesktop?: boolean;
}

/* ── Shared image card ── */

interface ImageCardProps {
  item: GalleryItem;
  index: number;
  className: string;
  sizes: string;
  onClick: (index: number, el: HTMLElement) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const ImageCard = memo(function ImageCard({
  item,
  index,
  className,
  sizes,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: ImageCardProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const wrapper = e.currentTarget;
      const imageContainer = wrapper.querySelector<HTMLElement>(
        '[data-gallery="image"]',
      );
      if (imageContainer) onClick(index, imageContainer);
    },
    [index, onClick],
  );

  // Cursor splash, anchored on the image_container so the ripple canvas shares
  // the picture's exact box. Stays live in BOTH places: opening a card does
  // `wrapper.appendChild(imageEl)` on this very element (see
  // gallery-animations.ts), so the host — canvas and all — travels into the
  // content panel and the effect carries on there. The hook re-measures itself
  // whenever that move resizes it, so it is never left drawing at the old
  // grid-card size.
  const splashRef = useRef<HTMLDivElement>(null);
  useSplashHover(splashRef);

  // On-scroll pixelated reveal, mounted on this same parent div — the icon
  // resolves from a few big blocks to sharp as the row scrolls in. Shares the
  // host with the splash above: both lay a canvas over the <img> and leave the
  // markup alone, and the reveal keeps the splash's canvas out of the way while
  // it runs (see gallery.css).
  usePixelReveal(splashRef, item.src);

  return (
    <div
      className={className}
      data-gallery="image-wrapper"
      data-item-id={item.id}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        ref={splashRef}
        className="image_container overflow-hidden"
        data-gallery="image"
      >
        <img
          src={item.src}
          loading="lazy"
          sizes={sizes}
          alt={item.alt}
          srcSet={item.srcSet}
          data-parallax="img"
        />
      </div>
    </div>
  );
});

/* ── GalleryGrid ── */

const GalleryGrid = memo(
  forwardRef<HTMLDivElement, GalleryGridProps>(function GalleryGrid(
    { items, onImageClick, onMouseEnter, onMouseLeave, isTouch, isDesktop = true },
    ref,
  ) {
    const sectionRef = useRef<HTMLDivElement>(null);

    /* Whether this screen gets the stacked layout instead of the pinned
       headline the icons fly across.

       The pin is a WIDE-screen device. The icons crossing the paragraph is
       the whole point of it — the headline is z-20 with mix-blend-mode:
       difference so it inverts against each icon travelling under it — but
       that only reads as depth where the paragraph is wide enough to be a
       backdrop. At 820px it is not: the icons are a third of the screen and
       they land squarely on the words, which is what the client saw first at
       phone width and then on a tablet.

       It used to be isTouch alone, which answers "can you hover" when the
       question is "is there room", so it also diverged between a real device
       and the same width in a browser's responsive view. Now it is the
       section's own 1024px breakpoint — the one its lightbox already draws —
       plus touch, and the layout class, the ScrollTrigger and the tunnel's
       depth all read this one flag, so they cannot disagree. */
    const stacked = isTouch || !isDesktop;

    // ── Scroll-driven image parallax on gallery cards ──
    useScrollParallaxImage('[data-gallery="image"]', isTouch);

    // ── Tunnel entrance for the process rows ──
    // Small screens get a shallower tunnel: the same move at desktop depth
    // starts the icon at a handful of pixels on a 390px-wide screen, which
    // reads as a speck popping in rather than something approaching. A nearer
    // camera and a shorter run keep the effect legible at that size. Keyed to
    // `stacked` for the same reason the layout is — it is about room.
    useTunnelReveal(
      "[data-row]",
      stacked ? { depth: 1100, perspective: 620 } : {},
    );

    // GSAP ScrollTrigger — scroll-driven highlight of the background text.
    // Desktop: the text is PINNED on screen and the lines fill one-after-another
    // as the section scrolls. Touch/small screens: no pin (mobile pinning is
    // janky and the layout stacks), just scrub the same fill as the headline
    // passes through the viewport — so the text still highlights on scroll.
    useEffect(() => {
      // Reduced-motion users get the statically-filled text via CSS (see
      // gallery.css) — don't run the scroll animation for them.
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }
      const section = sectionRef.current;
      if (!section) return;

      // Holder rather than a local, so the effect's cleanup can tear down a
      // reveal that is still mid-flight when the component unmounts.
      const revealRef: {
        current: ReturnType<typeof createPixelTextReveal>;
      } = { current: null };
      // The watchdog interval lives outside gsap's context — the cleanup must
      // clear it itself.
      const watchdogRef = { id: 0 };

      const ctx = gsap.context(() => {
        const pinWrap = section.querySelector<HTMLElement>(".gallery-pin-wrap");
        const headline = section.querySelector<HTMLElement>(
          ".gallery_bg-headline",
        );
        if (!pinWrap || !headline) return;
        // Bound after the guard: `update` below is a hoisted function
        // declaration, so TypeScript cannot carry the null-narrowing into it.
        const headlineEl = headline;
        // Same reason — buildHighlight() reads the section to measure the rows.
        const sectionEl = section;

        const lines = headline.querySelectorAll<HTMLElement>(".line");
        if (lines.length === 0) return;

        // ── Init: dim + pushed down ──
        gsap.set(lines, {
          backgroundSize: "0%",
          y: 30,
        });

        const revealLines = Array.from(lines);

        // ── The highlight: built ONCE, up front ───────────────────────────
        // Everything with a layout consequence — above all the pin, which
        // inserts a pin-spacer and so changes the document height — is created
        // here, before anything has scrolled. Creating the pin later (it used to
        // be built when the pixel reveal finished) moved the page under the
        // reader mid-scroll: the document grew by a spacer's worth and the view
        // jumped before the fill ran.
        //
        // Ordering matters too: the pin is created before the fill's trigger, so
        // the fill measures the pinned range rather than the unpinned one.
        // It is never disabled. The pixel stage HIDES the type the fill is
        // filling, so the fill cannot be seen while the blocks are up — and
        // because it keeps scrubbing underneath, the instant the type is handed
        // back it already holds exactly the value the current scroll position
        // calls for. Disabling it for the sweep and re-enabling on handoff is
        // what made the two feel out of step: the fill sat frozen through the
        // sweep and then snapped to catch up with where you had scrolled to.
        //
        // Leaving it live also gives both approaches for free, with no direction
        // handling of its own:
        //   • from above — progress ≈ 0 at handoff, so the words arrive unlit and
        //     fill as you carry on down;
        //   • from below — progress ≈ 1, so they arrive already complete, and
        //     scrolling further up unwinds the fill.
        // Neither re-fires the sweep: only the far-away re-arm can set that up.
        buildHighlight();

        // ── Stage one: the pixel sweep ────────────────────────────────────
        // Timed, not scrubbed. It is a fixed piece of motion, and tying it to the
        // scroll wheel made it feel like something being dragged rather than
        // something playing.
        //
        // What keeps it in step with the highlight is a DEADLINE rather than a
        // shared clock: the sweep must be gone by the moment the headline goes
        // sticky, because that is the instant the fill starts (the pin's start and
        // the fill's start are the same scroll position — .gallery-pin-wrap is one
        // screen tall with the headline centred in it). So it starts as the words
        // enter, and if the pin arrives first it snaps to sharp and hands over
        // there and then. It cannot bleed into the highlight.
        //
        // The hand-off itself is invisible: the sweep's last frame is the type
        // drawn SHARP, held a beat, so swapping the canvas for the real text
        // changes nothing on screen (see SETTLE_MS in pixelTextReveal).
        let armed = false;

        const arm = () => {
          // Same guard as the process icons (usePixelReveal): a card's modal
          // scroll-lock pins the body and forces the document scroll to 0, so
          // every scroll-derived trigger reads "the visitor left the gallery"
          // and this re-arm fired — dropping blocks over the headline behind
          // the open card, with no crossing left to resolve them.
          if (document.querySelector(".section_content.is-active")) return;
          revealRef.current?.revert();
          revealRef.current = createPixelTextReveal(headlineEl, revealLines);
          armed = !!revealRef.current;
        };

        const play = () => {
          if (!armed) return;
          revealRef.current?.play();
        };

        // The deadline. onEnter covers arriving from above, onEnterBack arriving
        // from below — either way we are now inside the sticky range, so the
        // blocks are done.
        const forceFinish = () => {
          if (!revealRef.current) return;
          revealRef.current.finishNow();
          armed = false;
        };

        arm();

        // Start the sweep as the words come into view, from either direction.
        ScrollTrigger.create({
          id: "gallery-bg-pixel",
          trigger: headline,
          start: "top 85%",
          onEnter: play,
          onEnterBack: play,
        });

        // The deadline: the headline CENTRED. That position is where it goes
        // sticky on desktop (the one-screen wrap pins exactly there) and where
        // the mobile fill's range begins, so one trigger covers both layouts.
        //
        // The range runs on to "bottom top" rather than being a 1px hairline. A
        // hairline is silently SKIPPED by any scroll jump bigger than itself —
        // which every wheel notch is — so a quick flick sailed past the centre
        // with the blocks still up and the type still hidden. A wide range still
        // fires onEnter when a jump lands the playhead inside it.
        //
        // onEnter only, deliberately: that is the downward approach, where the
        // sweep has had the run from "top 85%" to the centre to play. Arriving
        // from BELOW, the headline is sticky the instant it appears, so a
        // deadline there would cut the sweep off before it started — it gets its
        // full run instead, and the fill is already complete behind it.
        ScrollTrigger.create({
          id: "gallery-bg-pixel-deadline",
          trigger: headline,
          start: "center center",
          end: "bottom top",
          onEnter: forceFinish,
        });

        // Re-arm on the same rule as the process icons (see usePixelReveal): only
        // once the viewport is a full screen clear of the whole gallery, so
        // scrolling around the headline never re-pixelates it — leaving for a
        // neighbouring section and coming back does. Absolute scroll positions
        // rather than offsets, with a fallback for when the page cannot offer a
        // full screen of clearance above the section.
        const sectionTop = () =>
          section.getBoundingClientRect().top + window.scrollY;
        const sectionBottom = () =>
          section.getBoundingClientRect().bottom + window.scrollY;
        ScrollTrigger.create({
          id: "gallery-bg-pixel-rearm",
          trigger: section,
          start: () => {
            const vh = window.innerHeight;
            const clear = sectionTop() - vh - vh;
            return clear > 0 ? clear : Math.max(0, sectionTop() - vh);
          },
          end: () => sectionBottom() + window.innerHeight,
          invalidateOnRefresh: true,
          onLeave: arm,
          onLeaveBack: arm,
        });

        // ── Watchdog: stuck blocks are impossible by construction ────────
        // Everything above is gated on trigger CROSSINGS, and a missed
        // crossing — a scroll jump bigger than a range, a card's scroll lock
        // rewriting positions mid-flight, a reveal armed while the playhead
        // already sat inside the play range — left the headline stuck on its
        // blocks with nothing due to fire until the far-away re-arm boundary
        // (which is up at the section above; that is where visitors found it
        // "healing"). This closes every such hole with POSITION, not
        // crossings: while blocks are up, if the headline is actually in
        // view, the sweep plays; if the visitor is already past the deadline
        // position, it snaps sharp. Polled coarsely — it is a safety net, not
        // a driver, and 300ms is far below the time anyone can perceive
        // blocks as "stuck".
        watchdogRef.id = window.setInterval(() => {
          if (!armed || !revealRef.current || revealRef.current.isDone())
            return;
          if (document.querySelector(".section_content.is-active")) return;
          const r = headlineEl.getBoundingClientRect();
          const vh = window.innerHeight;
          if (r.bottom <= 0 || r.top >= vh) return; // off screen — fine
          if (r.top + r.height / 2 <= vh / 2) {
            forceFinish(); // past the deadline: the fill owns it now
          } else if (r.top <= vh * 0.85) {
            play(); // in view: give the sweep its run
          }
        }, 300);

        function buildHighlight() {
        if (stacked) {
          // Mobile: no pin. Ends at "top 35%" so the reveal finishes while
          // the text is still in view.
          const tl = gsap.timeline({
            scrollTrigger: {
              id: "gallery-bg-reveal",
              // Starts where the pixel sweep finishes — the headline centred —
              // rather than at "top 80%", which had the fill already running
              // while the blocks were still resolving.
              trigger: headline,
              start: "center center",
              // 25% of a screen, not 60%. The fill and the rows' margin-top
              // in gallery.css are ONE pacing pair — the margin has to cover
              // the fill, so a long fill buys a long wait — and at 60% the
              // pair spent 1.2 screens between the paragraph and the first
              // icon, one of them completely empty. It was also too long for
              // its own subject: the headline's bottom edge left the top of
              // the screen at 57%, so the last of the fill ran where nobody
              // could see it. At 25% the three lines finish lighting with the
              // paragraph still in the upper third, and the first icon is
              // entering the fold as they do.
              end: "+=25%",
              scrub: 0.8,
            },
          });
          lines.forEach((line, i) => {
            tl.to(
              line,
              { backgroundSize: "100%", y: 0, ease: "none", duration: 1 },
              i,
            );
          });
          return tl;
        }

        // ── Desktop: the paragraph is the BACKDROP the icons fly through ──
        // The fill still owns the first stretch of the pin on its own — that
        // stretch IS the paragraph animation — and the pin then carries on
        // until the last row has passed, so the icons cross the headline
        // instead of starting below it. That crossing is the whole point of the
        // headline being z-20 with `mix-blend-mode: difference` (gallery.css):
        // it inverts against each icon travelling under it.
        //
        // pinSpacing is OFF, so the pin inserts no spacer and the rows keep
        // scrolling while the headline holds. Dropping the spacer normally
        // collapses the pinned element out of the flow and jerks everything
        // below it up by a screen; it cannot here, because
        // `.gallery--overlap .gallery-pin-wrap` is already absolute and out of
        // flow. The height it used to contribute is now the rows' margin-top —
        // static markup, not something that changes mid-scroll.
        const vh = () => window.innerHeight || 800;
        const rowsEl = sectionEl.querySelector<HTMLElement>(
          "[data-rows-container]",
        );
        // Both ranges are MEASURED off the rows' own box rather than restating
        // a viewport multiple, so there is exactly one place — the rows'
        // margin-top in gallery.css — that decides how long the paragraph gets
        // to itself. Hard-coding the same figure here as well is how the two
        // drift apart the first time that margin is tuned.
        //
        //   fill  — ends the moment the first row reaches the fold, which is
        //           when the rows' top edge is one screen away.
        //   pin   — ends as the section itself leaves, i.e. when its bottom
        //           edge reaches the bottom of the viewport.
        //
        // The pin deliberately does NOT end when the last row clears the top of
        // the screen. Being fixed, the paragraph goes on covering the top of
        // the VIEWPORT rather than the top of the section, so releasing it on
        // the rows left it hanging over the start of the works rail below.
        // Tying it to the section means the paragraph is still on a full screen
        // of its own section when it lets go, and scrolls away with it.
        const rowsTop = () => rowsEl?.offsetTop ?? 0;
        const fillEnd = () => "+=" + Math.max(1, Math.round(rowsTop() - vh()));
        const pinEnd = () =>
          "+=" + Math.max(1, Math.round(sectionEl.offsetHeight - vh()));
        ScrollTrigger.create({
          id: "gallery-pin",
          trigger: pinWrap,
          start: "top top",
          end: pinEnd,
          pin: pinWrap,
          pinSpacing: false,
          invalidateOnRefresh: true,
        });

        // ── Sequential reveal: each line fills in its own segment ──
        const tl = gsap.timeline({
          scrollTrigger: {
            id: "gallery-bg-reveal",
            trigger: pinWrap,
            start: "top top",
            end: fillEnd,
            scrub: 0.8,
          },
        });
        lines.forEach((line, i) => {
          tl.to(
            line,
            { backgroundSize: "100%", y: 0, ease: "none", duration: 1 },
            i, // sequential, non-overlapping segments (line 0, then 1, then 2)
          );
        });
        // Hold the lit text for the last stretch of the pin.
        tl.to({}, { duration: 1 });
        return tl;
        }
      }, section);

      return () => {
        // A reveal caught mid-sweep owns a canvas and has the lines hidden, and
        // the ticker callback and observer are outside gsap's context — reverting
        // the context alone would leave all three behind.
        window.clearInterval(watchdogRef.id);
        revealRef.current?.revert();
        revealRef.current = null;
        ctx.revert();
      };
    }, [stacked]);

    // Merge forwarded ref + local ref for ScrollTrigger
    const mergedRef = useCallback(
      (node: HTMLDivElement | null) => {
        (sectionRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
        if (typeof ref === "function") ref(node);
        else if (ref)
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    return (
      <div
        ref={mergedRef}
        // `gallery--overlap` lifts the headline out of the flow and reserves
        // the rows' hold in its place (gallery.css). It is gated on the SAME
        // flag that decides whether the pin is created at all — the layout and
        // the ScrollTrigger have to agree.
        className={`w-full relative pt-[12vh] pb-[12vh]${stacked ? " gallery--stacked" : " gallery--overlap"}`}
        data-section="gallery"
      >
        {/* ═══════════════════════════════════════════════════════
            Background layer — GSAP ScrollTrigger pin
            Pinned on screen while section scrolls; z-0 behind images
            ═══════════════════════════════════════════════════════ */}
        {/* z-20 puts the pinned paragraph IN FRONT of the image rows (z-10) so
            its `mix-blend-mode: difference` glyphs invert against each image
            they overlap (see gallery.css). Stays pointer-events-none, so the
            images underneath remain clickable. */}
        <div className="gallery-pin-wrap w-full h-screen flex items-center justify-center overflow-hidden pointer-events-none z-20">
          <h1
            aria-hidden="true"
            className="gallery_bg-headline select-none text-center leading-[1.15] tracking-[-0.02em] font-light"
            style={{
              fontSize: "clamp(1.5rem, 4vw, 5rem)",
            }}
          >
            <span className="line">Where design leads</span>
            <br />
            <span className="line">engineering to deliver</span>
            <br />
            <span className="line">seamless digital experiences.</span>
          </h1>

          {/* Click-to-expand hint — tells the user the surrounding images open.
              Kept out of the blended <h1> so it stays plainly legible, and
              pinned near the bottom so it holds on screen through the section. */}
          <div className="gallery-hint" aria-hidden="true">
            <span className="gallery-hint__dot" />
            Click any image to expand
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            Foreground — alternating image rows
            Scroll normally; pinned text overlays via z-index
            ═══════════════════════════════════════════════════════ */}
        <div className="relative z-10" data-rows-container>
          {items.map((item, i) => {
            const isEven = i % 2 === 0;

            return (
              <div
                key={item.id}
                data-row
                className={`flex items-center min-h-[35vh] px-[5vw] gap-[2vw] py-[3vh]
                  max-md:min-h-[24vh] max-md:gap-[4vw] max-md:px-[6vw] max-md:py-[4vh]
                  ${isEven ? "flex-row" : "flex-row-reverse"}`}
              >
                {/* ── Label ──
                    Stays a column (number over title) and keeps its alternating
                    edge alignment at every width, so it reads as a pair with the
                    icon beside it rather than a caption stacked above it. */}
                <div
                  data-row-label
                  className={`shrink-0 flex flex-col gap-1
                    ${isEven ? "items-start text-left pr-[2vw] max-md:pr-0" : "items-end text-right pl-[2vw] max-md:pl-0"}`}
                >
                  <span className="text-[0.6rem] tracking-[0.35em] uppercase text-foreground-subtle font-mono">
                    [{String(i + 1).padStart(2, "0")}]
                  </span>
                  <span className="text-[clamp(0.75rem,1vw,1rem)] font-semibold text-foreground-muted leading-tight tracking-wide uppercase max-w-[14ch]">
                    {item.titleTop}
                  </span>
                </div>

                {/* ── Image ── */}
                <ImageCard
                  item={item}
                  index={i}
                  className="gallery_hero-image shrink-0 cursor-pointer overflow-hidden pointer-events-auto
                    w-[clamp(200px,30vw,400px)] aspect-3/2
                    max-md:w-[48vw]"
                  sizes="(max-width: 767px) 48vw, 32vw"
                  onClick={onImageClick}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }),
);

export default GalleryGrid;
