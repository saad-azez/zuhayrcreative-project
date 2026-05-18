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

  // Activate section content layer
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
 * Close animation — matches CodePen reference:
 * 1. Text animates out (titles + lines, all at "start")
 * 2. At +0.25s: Flip image BACK from content → grid
 * 3. AFTER Flip: restore other images' clip paths (INSET → NONE, sequential)
 *
 * CRITICAL: Do NOT hide the content panel before Flip.getState —
 * the image must still be measurable for Flip to capture its current position.
 */
export function animateClose({
  item,
  splits,
  sectionContent,
  gridEl,
  onComplete,
}: AnimateCloseParams): gsap.core.Timeline {
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

  // Restore scrolling immediately
  document.body.style.overflow = "";
  gridEl.style.pointerEvents = "";

  // Gather wrappers
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
    onComplete: () => {
      // Hide the active content panel (matching CodePen reference)
      targetContent.classList.add("is-hidden");
      // Hide section content layer
      sectionContent.classList.add("is-hidden");
      sectionContent.classList.remove("is-active");
      onComplete();
    },
  });

  tl.addLabel("start", 0)

    // ── 1. Text animates out (all at "start") ──
    .fromTo(
      [...titleTopEls, ...titleBottomEls],
      { xPercent: 0 },
      { xPercent: 10, ease: TEXT_EASE, duration: 1 },
      "start",
    )
    .fromTo(
      allTitleChars,
      { clipPath: "inset(0 0% 0 0)", xPercent: 0 },
      {
        clipPath: "inset(0 100% 0 0)",
        xPercent: 10,
        ease: TEXT_EASE,
        duration: 0.75,
      },
      "start",
    )
    .to(
      allTextLines,
      { yPercent: 100, stagger: 0.025, duration: 0.75 },
      "start",
    )

    // ── 2. Flip image BACK from content → grid (at +0.25s) ──
    // IMPORTANT: Do NOT hide content panel before Flip.getState —
    // the image must be measurable for accurate position capture.
    .add(() => {
      const imageContainer = wrapper.querySelector<HTMLElement>(SEL_IMAGE);
      if (!imageContainer) return;

      const gridWrapper = document.querySelector<HTMLElement>(
        `[${ATTR_ITEM}="${String(item.id)}"]`,
      );
      if (!gridWrapper) return;

      // Capture state BEFORE moving — image is still in content wrapper
      const flipState = Flip.getState(imageContainer);

      // Move image back to its original gallery wrapper
      // Use appendChild (matching CodePen) — image goes after any existing children
      gridWrapper.appendChild(imageContainer);

      // Animate from content position → grid position
      Flip.from(flipState, {
        duration: DURATION,
        ease: CLIP_EASE,
        // Clear absolute positioning inherited from content wrapper
        onComplete: () => {
          gsap.set(imageContainer, {
            clearProps: "position,inset,width,height,zIndex",
          });
        },
      });
    }, "start+=0.25")

    // ── 3. Restore other images (SEQUENTIAL — after Flip completes) ──
    // CodePen runs these without explicit position → they queue after Flip
    .to(otherWrappers, {
      clipPath: "inset(0% 0 0 0)",
      duration: 0.5,
      ease: CLIP_EASE,
    })
    .set(allWrappers, { clipPath: "none" });

  return tl;
}
