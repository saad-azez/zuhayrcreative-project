import SplitType from "split-type";

export interface GallerySplits {
  titleTopSplits: SplitType[];
  titleBottomSplits: SplitType[];
  textLeftSplits: SplitType[];
  textRightSplits: SplitType[];
}

/**
 * Initialize SplitType on content elements and wrap chars/lines for animation.
 * Shared between ContentPanel (init) and VerticalGallery (consume).
 */
export function createSplits(content: HTMLElement): GallerySplits {
  const selectAll = (selector: string) =>
    content.querySelectorAll<HTMLElement>(selector);

  const titleTopSplits = Array.from(
    selectAll('[data-content="text-top"] div'),
    (el) => new SplitType(el, { types: "chars" }),
  );

  const titleBottomSplits = Array.from(
    selectAll('[data-content="text-bottom"] div'),
    (el) => new SplitType(el, { types: "chars" }),
  );

  // Wrap chars for clip-path animation
  titleTopSplits[0]?.chars?.forEach(wrapChar);

  const textLeftSplits = Array.from(
    selectAll('[data-content="text-left"] div'),
    (el) => new SplitType(el, { types: "lines" }),
  );

  const textRightSplits = Array.from(
    selectAll('[data-content="text-right"] div'),
    (el) => new SplitType(el, { types: "lines" }),
  );

  // Wrap lines for overflow animation
  for (const splits of [textLeftSplits, textRightSplits]) {
    for (const split of splits) {
      split.lines?.forEach(wrapLine);
    }
  }

  return { titleTopSplits, titleBottomSplits, textLeftSplits, textRightSplits };
}

function wrapChar(char: HTMLElement): void {
  const wrapper = document.createElement("div");
  wrapper.classList.add("char-wrap");
  char.parentNode?.insertBefore(wrapper, char);
  wrapper.appendChild(char);
}

function wrapLine(line: HTMLElement): void {
  const wrapper = document.createElement("div");
  wrapper.classList.add("line-wrap");
  line.parentNode?.insertBefore(wrapper, line);
  wrapper.appendChild(line);
}
