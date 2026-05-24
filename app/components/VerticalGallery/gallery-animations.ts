import gsap from "gsap";
import { Flip } from "gsap/Flip";
import type { GalleryItem } from "./galleryData";
import type { GallerySplits } from "./splitText";

gsap.registerPlugin(Flip);

/* ── Selector helpers ── */

const SEL_WRAPPER = '[data-gallery="image-wrapper"]';
const SEL_IMAGE = '[data-gallery="image"]';
const SEL_DETAILS = '[data-content="details-wrapper"]';
const ATTR_ITEM = "data-item-id";

/* ── Animation config (matches CodePen reference exactly) ── */

const DURATION = 1.25;
const EASE = "power4.inOut";
const CLIP_EASE = "power3.inOut";
const TEXT_EASE = "power3.out";

interface AnimateOpenParams {
  index: number;
  item: GalleryItem;
  imageEl: HTMLElement;
  splits: GallerySplits;
  sectionContent: HTMLElement;
  gridEl: HTMLElement;
  onStart: () => void;
  onComplete: () => void;
}

/**
 * Open animation — matches CodePen reference:
 * 1. Flip image from grid → content wrapper
 * 2. Clip other images away (inset from top, parallel with Flip)
 * 3. Title elements slide in (xPercent: 15 → 0)
 * 4. Title chars reveal (clipPath: right → full)
 * 5. Text lines fade up (yPercent: 100 → 0 + opacity)
 */
export function animateOpen({
  index: _index,
  item,
  imageEl,
  splits,
  sectionContent,
  gridEl,
  onStart,
  onComplete,
}: AnimateOpenParams): gsap.core.Timeline {
  const targetContent = sectionContent.querySelector<HTMLElement>(
    `[data-content-id="${item.id}"]`,
  );
  if (!targetContent) {
    throw new Error(`Content panel not found for item ${item.id}`);
  }

  const wrapper = targetContent.querySelector<HTMLElement>(SEL_DETAILS);
  if (!wrapper) {
    throw new Error(`Details wrapper not found for item ${item.id}`);
  }

  // Activate section content layer (pointer-events only; bg animated via GSAP)
  sectionContent.classList.add("is-active");

  // Gather all gallery wrappers; filter out the clicked one for clipping
  const allWrappers = gsap.utils.toArray<HTMLElement>(SEL_WRAPPER);
  const otherWrappers = allWrappers.filter(
    (w) => w.getAttribute(ATTR_ITEM) !== String(item.id),
  );

  // ── Extract split elements ──
  const titleTopData = splits.titleTopSplits[0] as
    | {
        elements?: HTMLElement[];
        chars?: HTMLElement[];
      }
    | undefined;
  const titleBottomData = splits.titleBottomSplits[0] as
    | {
        elements?: HTMLElement[];
        chars?: HTMLElement[];
      }
    | undefined;

  const titleTopEls = titleTopData?.elements ?? [];
  const titleBottomEls = titleBottomData?.elements ?? [];
  const topChars = titleTopData?.chars ?? [];
  const bottomChars = titleBottomData?.chars ?? [];
  const allTitleChars = [...topChars, ...bottomChars];

  // will-change on chars for GPU-accelerated clip-path animation
  for (const char of allTitleChars) {
    char.style.willChange = "transform, clip-path";
  }

  const textLeftLines = splits.textLeftSplits.flatMap(
    (s) => (s as { lines?: HTMLElement[] }).lines ?? [],
  );
  const textRightLines = splits.textRightSplits.flatMap(
    (s) => (s as { lines?: HTMLElement[] }).lines ?? [],
  );
  const allTextLines = [...textLeftLines, ...textRightLines];

  // ── Timeline ──
  const tl = gsap.timeline({
    defaults: { duration: DURATION, ease: EASE },
    onStart: () => {
      sectionContent.classList.remove("is-hidden");
      onStart();
    },
    onComplete: () => {
      // Lock grid interaction while content is open
      gridEl.style.pointerEvents = "none";
      document.body.style.overflow = "hidden";
      // Clean up will-change
      for (const char of allTitleChars) {
        char.style.willChange = "auto";
      }
      onComplete();
    },
  });

  tl.addLabel("start", 0)
    .addLabel("texts", 0.5)

    // ── 1. GSAP Flip: image from grid → content panel ──
    .add(() => {
      const flipState = Flip.getState(imageEl);
      // Use appendChild (not prepend) to match CodePen — adds at end of wrapper
      wrapper.appendChild(imageEl);
      Flip.from(flipState, {
        duration: DURATION,
        ease: EASE,
        // Ensure absolute positioning snaps immediately inside the wrapper
        onEnter: (els) => {
          gsap.set(els, {
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          });
        },
      });
    }, "start")

    // ── 2. Clip other images away (parallel with Flip, position 0) ──
    .to(
      otherWrappers,
      {
        clipPath: "inset(100% 0 0 0)",
        duration: 0.75,
        ease: CLIP_EASE,
      },
      0,
    )

    // ── 2b. Animate overlay background in (parallel, position 0) ──
    .to(
      sectionContent,
      {
        background: "rgba(56, 0, 14, 0.85)",
        duration: 0.6,
        ease: CLIP_EASE,
      },
      0,
    )

    // ── 3. Title elements slide in (delayed 1.25s) ──
    .fromTo(
      [...titleTopEls, ...titleBottomEls],
      { xPercent: 15 },
      { xPercent: 0, duration: 1, ease: TEXT_EASE },
      "start+=1.25",
    )

    // ── 4. Title chars reveal via clip-path (delayed 1.25s) ──
    .fromTo(
      allTitleChars,
      {
        clipPath: "inset(0 100% 0 0)",
        xPercent: 10,
      },
      {
        clipPath: "inset(0 0% 0 0)",
        xPercent: 0,
        duration: 0.75,
        ease: TEXT_EASE,
      },
      "start+=1.25",
    )

    // ── 5. Text lines fade up (delayed 1.2s, staggered) ──
    .fromTo(
      allTextLines,
      { yPercent: 100, opacity: 0 },
      { yPercent: 0, opacity: 1, stagger: 0.025 },
      "start+=1.2",
    );

  return tl;
}

/* ── Close ── */

interface AnimateCloseParams {
  item: GalleryItem;
  splits: GallerySplits;
  sectionContent: HTMLElement;
  gridEl: HTMLElement;
  onComplete: () => void;
}

/**
 * Close — fade the entire overlay (image + text + bg) to zero,
 * unclip the other grid images, then silently move the image
 * back to its grid cell on complete. No Flip needed for close;
 * a uniform opacity fade prevents desynchronized tearing.
 */
export function animateClose({
  item,
  splits: _splits,
  sectionContent,
  gridEl,
  onComplete,
}: AnimateCloseParams): gsap.core.Timeline {
  const targetContent = sectionContent.querySelector<HTMLElement>(
    `[data-content-id="${item.id}"]`,
  );
  const wrapper =
    targetContent?.querySelector<HTMLElement>(SEL_DETAILS) ?? null;
  const imageEl = wrapper?.querySelector<HTMLElement>(SEL_IMAGE) ?? null;
  const allWrappers = gsap.utils.toArray<HTMLElement>(SEL_WRAPPER);
  const otherWrappers = allWrappers.filter(
    (w) => w.getAttribute(ATTR_ITEM) !== String(item.id),
  );

  // Restore scrolling immediately
  document.body.style.overflow = "";
  gridEl.style.pointerEvents = "";

  const tl = gsap.timeline({
    onComplete: () => {
      // ── Silently move image back to grid ──
      if (imageEl) {
        // Reset inline styles that the open Flip applied
        imageEl.style.position = "";
        imageEl.style.inset = "";
        imageEl.style.width = "";
        imageEl.style.height = "";
        imageEl.style.transform = "";
        imageEl.style.opacity = "";

        const gridWrapper = document.querySelector<HTMLElement>(
          `[${ATTR_ITEM}="${String(item.id)}"]`,
        );
        if (gridWrapper) {
          gridWrapper.appendChild(imageEl);
        }
      }

      // Reset clip-paths
      for (const w of allWrappers) {
        w.style.clipPath = "";
      }

      // Clean up inline styles on overlay
      sectionContent.style.opacity = "";
      sectionContent.style.background = "";

      // Clean up classes
      if (targetContent) targetContent.classList.add("is-hidden");
      sectionContent.classList.add("is-hidden");
      sectionContent.classList.remove("is-active");

      onComplete();
    },
  });

  // ── 1. Fade entire overlay: opacity 0 + bg transparent ──
  tl.to(
    sectionContent,
    {
      opacity: 0,
      background: "transparent",
      duration: 0.6,
      ease: "power3.inOut",
    },
    0,
  )

    // ── 1b. Explicitly fade the image itself (in case it has its own opacity) ──
    .to(
      imageEl,
      {
        opacity: 0,
        duration: 0.6,
        ease: "power3.inOut",
      },
      0,
    )

    // ── 2. Unclip other grid images (parallel, same duration) ──
    .to(
      otherWrappers,
      {
        clipPath: "inset(0% 0 0 0)",
        duration: 0.6,
        ease: "power3.inOut",
      },
      0,
    );

  return tl;
}
