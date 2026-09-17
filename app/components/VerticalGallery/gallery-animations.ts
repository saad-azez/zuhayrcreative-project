import gsap from "gsap";
import { Flip } from "gsap/Flip";
import type { GalleryItem } from "./galleryData";
import type { GallerySplits } from "./splitText";
import {
  playImageTrail,
  type TrailRect,
} from "@/app/animations/repeatingImageTransition";

gsap.registerPlugin(Flip);

/**
 * The box a picture is actually DRAWN in.
 *
 * The trail used to start and end on the image CONTAINER, and the containers
 * are not the pictures: the process icons are square SVGs laid out with
 * `object-fit: contain`, so in a 400x267 grid cell the icon is a 235x235
 * square (shifted by the scroll parallax), and in the 720x405 panel it is a
 * 405x405 square in the middle. Every clone filled the container's rectangle
 * with `object-fit: cover`, so the trail began as a big cropped icon where
 * the small one was, and landed the same way — on desktop, tablet and phone.
 *
 * This is the <img>'s own box (transforms included) narrowed to the image's
 * natural aspect, exactly as `contain` lays it out. A box with the image's
 * aspect draws identically under `cover`, so the clones match the picture.
 */
function containIn(
  box: { left: number; top: number; width: number; height: number },
  naturalW: number,
  naturalH: number,
): TrailRect {
  if (!naturalW || !naturalH || !box.width || !box.height) {
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  }
  const s = Math.min(box.width / naturalW, box.height / naturalH);
  const width = naturalW * s;
  const height = naturalH * s;
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height,
  };
}

function drawnBoxOf(host: HTMLElement): TrailRect {
  const img = host.querySelector("img");
  const r = (img ?? host).getBoundingClientRect();
  return containIn(r, img?.naturalWidth ?? 0, img?.naturalHeight ?? 0);
}

/**
 * Where each picture was drawn in the grid when it was opened, so the closing
 * trail lands back on the icon rather than on its empty cell. The scroll is
 * locked while a card is open and restored before the close, so the page is
 * in the same place both times.
 */
const gridBoxes = new WeakMap<HTMLElement, TrailRect>();

/**
 * Repeating image trail between two boxes, for the open/close transitions.
 *
 * Unlike the site's other galleries, this one has no separate lightbox image to
 * clip-wipe: `animateOpen` re-parents the REAL picture out of its grid cell and
 * Flips it into the panel. So the trail is added alongside that flight rather
 * than replacing it — the clones read as echoes strung out behind the picture
 * as it travels, and nothing about the existing layout or timing moves.
 *
 * `imageHost` is the `.image_container` div; the actual <img> is inside it, and
 * the clones copy that element's resolved source so they share its cache entry
 * (see the note on `crossOrigin` in repeatingImageTransition).
 */
function playTrailBetween(
  imageHost: HTMLElement,
  from: TrailRect,
  to: TrailRect,
): void {
  const img = imageHost.querySelector("img");
  if (!img) return;
  playImageTrail({
    from: { left: from.left, top: from.top, width: from.width, height: from.height },
    to: { left: to.left, top: to.top, width: to.width, height: to.height },
    src: img.currentSrc || img.src,
    crossOrigin: img.crossOrigin,
  });
}

/* ── Selector helpers ── */

const SEL_WRAPPER = '[data-gallery="image-wrapper"]';
const SEL_IMAGE = '[data-gallery="image"]';
const SEL_DETAILS = '[data-content="details-wrapper"]';
const SEL_MOBILE_IMG = '[data-content="mobile-image"]';
const SEL_MOBILE = ".content_mobile";
const ATTR_ITEM = "data-item-id";

/** The compact modal replaces the desktop wrapper below 1024px / on touch.
 *  Both host the Flip-moved image, so the animation is the same either way. */
function getFlipTarget(targetContent: HTMLElement): {
  target: HTMLElement | null;
  isModal: boolean;
} {
  const modal = targetContent.querySelector<HTMLElement>(SEL_MOBILE);
  const modalActive =
    !!modal &&
    typeof window !== "undefined" &&
    window.getComputedStyle(modal).display !== "none";
  if (modalActive) {
    return {
      target: targetContent.querySelector<HTMLElement>(SEL_MOBILE_IMG),
      isModal: true,
    };
  }
  return {
    target: targetContent.querySelector<HTMLElement>(SEL_DETAILS),
    isModal: false,
  };
}

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

  const { target: wrapper, isModal } = getFlipTarget(targetContent);
  if (!wrapper) {
    throw new Error(`Flip target not found for item ${item.id}`);
  }
  // The modal has no SplitType targets, so its copy block staggers instead.
  const modalCopy = isModal
    ? gsap.utils.toArray<HTMLElement>(
        targetContent.querySelectorAll(".content_mobile-copy > *"),
      )
    : [];

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
      // Scroll locking is owned by useGalleryState.
      gridEl.style.pointerEvents = "none";
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
      // Measure BEFORE the re-parent — the picture as it is drawn in the grid
      // cell it is leaving, and the trail's starting box. Kept for the close.
      const fromRect = drawnBoxOf(imageEl);
      gridBoxes.set(imageEl, fromRect);

      const flipState = Flip.getState(imageEl);
      // Use appendChild (not prepend) to match CodePen — adds at end of wrapper
      wrapper.appendChild(imageEl);
      // Kept on the timeline's data: this tween is created here, at play time,
      // so it is NOT a child of `tl` — fast-forwarding `tl` alone would leave
      // the picture still in flight. useGalleryState speeds both when a close
      // is asked for before the open has finished.
      tl.data = { flip: null as gsap.core.Animation | null };
      tl.data.flip = Flip.from(flipState, {
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

      // The picture ends up filling the wrapper (inset 0) and is drawn
      // contained inside it.
      const img = imageEl.querySelector("img");
      playTrailBetween(
        imageEl,
        fromRect,
        containIn(
          wrapper.getBoundingClientRect(),
          img?.naturalWidth ?? 0,
          img?.naturalHeight ?? 0,
        ),
      );
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
        background: "rgba(56, 0, 14, 0.55)",
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

  // ── 5b. Modal copy — same beat and easing as the split lines above ──
  if (modalCopy.length) {
    tl.fromTo(
      modalCopy,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, ease: TEXT_EASE, stagger: 0.08 },
      "start+=1.2",
    );
  }

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
 * Close — Flip the image back to its grid cell while the overlay
 * fades out behind it, and unclip other images with a staggered
 * slider-like reveal. Everything runs in one coordinated timeline.
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
  // The image sits in whichever layout is on screen.
  const imageEl =
    targetContent?.querySelector<HTMLElement>(SEL_IMAGE) ?? null;
  const allWrappers = gsap.utils.toArray<HTMLElement>(SEL_WRAPPER);
  const otherWrappers = allWrappers.filter(
    (w) => w.getAttribute(ATTR_ITEM) !== String(item.id),
  );

  gridEl.style.pointerEvents = "";

  /**
   * Clear the way for the flying image.
   *
   * The Flip below re-parents the image into its grid cell and animates it from
   * the panel's centre — but in the grid it is subject to two things the panel
   * never imposed, and together they made the exit invisible:
   *
   *   - the cell (.gallery_hero-image) is `overflow: hidden` around a small box,
   *     so an image still positioned mid-screen is clipped away completely;
   *   - the rows layer is z-index 10 while the overlay is 50 and spends the next
   *     0.7s fading out, so whatever escaped the clip was behind the panel.
   *
   * The result was an image that vanished from the centre and then reappeared,
   * already home, in the grid — no exit animation to be seen. Raising the rows
   * layer above the overlay for the flight also can't be done from inside the
   * cell: the rows container is a positioned, z-indexed element, so it flattens
   * any z-index its children set.
   *
   * Both are restored in onComplete.
   */
  const flyingWrapper = document.querySelector<HTMLElement>(
    `[${ATTR_ITEM}="${String(item.id)}"]`,
  );
  const rowsLayer = gridEl.querySelector<HTMLElement>("[data-rows-container]");
  if (flyingWrapper) flyingWrapper.style.overflow = "visible";
  if (rowsLayer) rowsLayer.style.zIndex = "60";

  const tl = gsap.timeline({
    onComplete: () => {
      if (flyingWrapper) flyingWrapper.style.overflow = "";
      if (rowsLayer) rowsLayer.style.zIndex = "";

      // ── Clean up image inline styles (Flip leaves transform/etc) ──
      if (imageEl) {
        imageEl.style.position = "";
        imageEl.style.inset = "";
        imageEl.style.width = "";
        imageEl.style.height = "";
        imageEl.style.transform = "";
        imageEl.style.opacity = "";
      }

      // Reset clip-paths
      for (const w of allWrappers) {
        w.style.clipPath = "";
      }

      // Clean up overlay inline styles
      sectionContent.style.opacity = "";
      sectionContent.style.background = "";

      // Clean up classes
      if (targetContent) targetContent.classList.add("is-hidden");
      sectionContent.classList.add("is-hidden");
      sectionContent.classList.remove("is-active");

      onComplete();
    },
  });

  // ── 1. Flip image back to grid (position 0, starts immediately) ──
  tl.add(() => {
    if (!imageEl) return;
    const gridWrapper = document.querySelector<HTMLElement>(
      `[${ATTR_ITEM}="${String(item.id)}"]`,
    );
    if (!gridWrapper) return;

    // Measure BEFORE the re-parent — the picture as it is drawn in the panel
    // it is leaving.
    const fromRect = drawnBoxOf(imageEl);
    const img = imageEl.querySelector("img");
    // Land where the picture was drawn in the grid when it was opened; if that
    // was never recorded, the cell with the picture contained in it.
    const toRect =
      gridBoxes.get(imageEl) ??
      containIn(
        gridWrapper.getBoundingClientRect(),
        img?.naturalWidth ?? 0,
        img?.naturalHeight ?? 0,
      );

    const flipState = Flip.getState(imageEl);
    // Move image back to its grid cell
    gridWrapper.appendChild(imageEl);
    // Animate from overlay position/size → grid position/size
    Flip.from(flipState, {
      duration: 0.7,
      ease: "power3.inOut",
      absolute: true,
    });

    playTrailBetween(imageEl, fromRect, toRect);
  }, 0);

  // ── 2. Fade overlay out behind the flipping image ──
  tl.to(
    sectionContent,
    {
      opacity: 0,
      background: "transparent",
      duration: 0.7,
      ease: "power3.inOut",
    },
    0,
  );

  // ── 3. Unclip other images — staggered for slider feel ──
  tl.to(
    otherWrappers,
    {
      clipPath: "inset(0% 0 0 0)",
      duration: 0.55,
      stagger: 0.04,
      ease: "power2.out",
    },
    0.08,
  );

  return tl;
}
