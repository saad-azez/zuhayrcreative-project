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

function getWrapperImage(wrapper: HTMLElement): HTMLElement | null {
  return wrapper.querySelector(SEL_IMAGE);
}

/* ── Animation config ── */

const DURATION = 1.25;
const EASE = "power4.inOut";

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
 * Open animation: Flip image to content panel, reveal texts, clip other images.
 * Returns the GSAP timeline so the caller can manage it.
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

  sectionContent.classList.add("is-active");

  const allWrappers = document.querySelectorAll<HTMLElement>(SEL_WRAPPER);
  const otherWrappers = Array.from(allWrappers).filter(
    (w) => w.getAttribute(ATTR_ITEM) !== String(item.id),
  );

  // Performance: will-change on chars
  const topChars = (
    splits.titleTopSplits[0] as { chars?: HTMLElement[] } | undefined
  )?.chars;
  if (topChars) {
    for (const char of topChars) {
      char.style.willChange = "transform, clip-path";
    }
  }

  const titleTopEls =
    (splits.titleTopSplits[0] as { elements?: HTMLElement[] } | undefined)
      ?.elements ?? [];
  const titleBottomEls =
    (splits.titleBottomSplits[0] as { elements?: HTMLElement[] } | undefined)
      ?.elements ?? [];
  const topCharsArr = topChars ?? [];
  const bottomChars =
    (splits.titleBottomSplits[0] as { chars?: HTMLElement[] } | undefined)
      ?.chars ?? [];
  const allTitleChars = [...topCharsArr, ...bottomChars];

  const textLeftLines = splits.textLeftSplits.flatMap(
    (s) => (s as { lines?: HTMLElement[] }).lines ?? [],
  );
  const textRightLines = splits.textRightSplits.flatMap(
    (s) => (s as { lines?: HTMLElement[] }).lines ?? [],
  );
  const allTextLines = [...textLeftLines, ...textRightLines];

  const tl = gsap.timeline({
    defaults: { duration: DURATION, ease: EASE },
    onStart: () => {
      sectionContent.classList.remove("is-hidden");
      onStart();
    },
    onComplete: () => {
      gridEl.style.pointerEvents = "none";
      document.body.style.overflow = "hidden";
      onComplete();
    },
  });

  tl.addLabel("start", 0)
    .addLabel("texts", 0.5)

    // Flip image from grid → content wrapper
    .add(() => {
      const flipState = Flip.getState(imageEl);
      wrapper.prepend(imageEl);
      Flip.from(flipState, { duration: DURATION, ease: EASE });
    }, "start")

    // Clip other images away
    .to(
      otherWrappers,
      { clipPath: "inset(100% 0 0 0)", duration: 0.75, ease: "power3.inOut" },
      0,
    )

    // Title elements slide in
    .fromTo(
      [...titleTopEls, ...titleBottomEls],
      { xPercent: 15 },
      { xPercent: 0, duration: 1, ease: "power3.out" },
      "start+=1.25",
    )

    // Title chars reveal via clip-path
    .fromTo(
      allTitleChars,
      { clipPath: "inset(0 100% 0 0)", xPercent: 10 },
      {
        clipPath: "inset(0 0% 0 0)",
        xPercent: 0,
        duration: 0.75,
        ease: "power3.out",
      },
      "start+=1.25",
    )

    // Text lines fade up
    .fromTo(
      allTextLines,
      { yPercent: 100, opacity: 0 },
      { yPercent: 0, opacity: 1, stagger: 0.025 },
      "start+=1.2",
    );

  return tl;
}

interface AnimateCloseParams {
  item: GalleryItem;
  splits: GallerySplits;
  sectionContent: HTMLElement;
  gridEl: HTMLElement;
  onComplete: () => void;
}

/**
 * Close animation: animate texts out, Flip image back to grid, restore clips.
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

  document.body.style.overflow = "";
  gridEl.style.pointerEvents = "";

  const allWrappers = document.querySelectorAll<HTMLElement>(SEL_WRAPPER);
  const otherWrappers = Array.from(allWrappers).filter(
    (w) => w.getAttribute(ATTR_ITEM) !== String(item.id),
  );

  const titleTopEls =
    (splits.titleTopSplits[0] as { elements?: HTMLElement[] } | undefined)
      ?.elements ?? [];
  const titleBottomEls =
    (splits.titleBottomSplits[0] as { elements?: HTMLElement[] } | undefined)
      ?.elements ?? [];
  const topChars =
    (splits.titleTopSplits[0] as { chars?: HTMLElement[] } | undefined)
      ?.chars ?? [];
  const bottomChars =
    (splits.titleBottomSplits[0] as { chars?: HTMLElement[] } | undefined)
      ?.chars ?? [];
  const allTitleChars = [...topChars, ...bottomChars];

  const textLeftLines = splits.textLeftSplits.flatMap(
    (s) => (s as { lines?: HTMLElement[] }).lines ?? [],
  );
  const textRightLines = splits.textRightSplits.flatMap(
    (s) => (s as { lines?: HTMLElement[] }).lines ?? [],
  );
  const allTextLines = [...textLeftLines, ...textRightLines];

  const tl = gsap.timeline({
    defaults: { duration: DURATION, ease: EASE },
    onComplete: () => {
      sectionContent.classList.add("is-hidden");
      sectionContent.classList.remove("is-active");
      onComplete();
    },
  });

  tl.addLabel("start", 0)
    .fromTo(
      [...titleTopEls, ...titleBottomEls],
      { xPercent: 0 },
      { xPercent: 10, ease: "power3.out", duration: 1 },
      "start",
    )
    .fromTo(
      allTitleChars,
      { clipPath: "inset(0 0% 0 0)", xPercent: 0 },
      {
        clipPath: "inset(0 100% 0 0)",
        xPercent: 10,
        ease: "power3.out",
        duration: 0.75,
      },
      "start",
    )
    .to(
      allTextLines,
      { yPercent: 100, stagger: 0.025, duration: 0.75 },
      "start",
    )
    .add(() => {
      targetContent.classList.add("is-hidden");
      sectionContent.classList.remove("is-active");

      const imageContainer = wrapper.querySelector<HTMLElement>(SEL_IMAGE);
      if (!imageContainer) return;

      const gridWrapper = document.querySelector<HTMLElement>(
        `[${ATTR_ITEM}="${String(item.id)}"]`,
      );
      if (!gridWrapper) return;

      const flipState = Flip.getState(imageContainer);
      gridWrapper.prepend(imageContainer);
      Flip.from(flipState, { duration: DURATION, ease: "power3.inOut" });
    }, "start+=0.25")
    .to(otherWrappers, { clipPath: "inset(0% 0 0 0)" }, "start+=0.25")
    .set(allWrappers, { clipPath: "none" }, "start+=1.5");

  return tl;
}
