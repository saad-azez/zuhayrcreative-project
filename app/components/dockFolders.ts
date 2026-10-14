/**
 * What the corner dock's glass folder holds: its coloured subfolders, and the
 * stamps inside each. Shared by the dock (CornerGlassDock) and the folder's
 * own sub dial (FolderSubDial), so swapping a stamp is one edit here.
 */

export interface Stamp {
  /** The art, painted contain-fit on the stamp's paper, at the dock's ~22px. */
  art: string;
  /** The same art at a size that stays sharp in the folder dial and enlarged
      (~240px across, 700+ device px on a phone). Loaded only once the dial
      opens, so the dock's tiny stamps never pay for it. */
  artLarge?: string;
  /** The paper's colour; cream when unset. */
  paper?: string;
  /** What the stamp shows, for the enlarged view's alt text. */
  label: string;
  /**
   * Not a stamp but a thing in its own right: drawn bare, with no paper and
   * no perforated edge, because its picture has an outline of its own.
   */
  bare?: boolean;
  /** A page a click on it goes to, in place of enlarging it. */
  href?: string;
}

/**
 * The occasion's stamps. Swap these for whatever is being celebrated or
 * highlighted — a seasonal mark, an event, a launch. Placeholders, pending
 * the client's new stamp icons and logos: the Hong Kong pin and the
 * cursor's emblem.
 */
export const STAMPS: ReadonlyArray<Stamp> = [
  // Through the image optimizer, not the raw file: the source PNG is 749x961
  // and 580KB. `w=384` (one of next.config's imageSizes) is sharp at the sub
  // dial's stamp size and in its enlarged view, and still a few-KB WebP/AVIF.
  {
    art: "/_next/image?url=%2Fhongkongmapicon.png&w=384&q=75",
    // q=75, the one quality the image optimizer is configured to serve: at
    // q=80 it answered 400 and the stamp came up as blank paper in the dial.
    artLarge: "/_next/image?url=%2Fhongkongmapicon.png&w=828&q=75",
    label: "Hong Kong",
  },
  // AI-9-cursor.png is the 128px cut of AI-9.png (384px): blurry enlarged
  // (client, 5 Oct: "the logo stamps seem to be low resolution").
  { art: "/AI-9-cursor.png", artLarge: "/AI-9.png", label: "Zuhayr AI" },
];

/**
 * The notebook, small, in the silver folder (client, 14 Oct: "can you put a
 * small version of the notebook inside the silver folder in +"). A picture of
 * it shut, as it lies on the Notes page, and a way there: a click opens that
 * page, where the real one can be opened and read.
 *
 * A picture, not the notebook itself: the real one is a 3D viewer of its
 * own, a megabyte and a half of script and a WebGL scene, which is a page's
 * worth of weight and not something for a corner of every page. The picture
 * is that viewer's own frame of the shut book, taken on nothing so only the
 * book is in it (the viewer mounted alone on a transparent page and shot
 * with its alpha): retake it if the client's notebook changes.
 */
export const NOTEBOOK: Stamp = {
  art: "/dock/notebook.webp",
  label: "Notes",
  bare: true,
  href: "/notes",
};

export interface Subfolder {
  /** Its name, for the sub dial's buttons. */
  name: string;
  /** The translucent front. */
  tint: string;
  /** The back panel, showing as the folder's thickness. */
  edge: string;
  /** How much the front blurs what is behind it, px; 5 when unset. */
  frost?: number;
  /** What it holds, back to front. */
  stamps: ReadonlyArray<Stamp>;
}

/**
 * The subfolders, in the brand's colours (client, 3 Oct: "one red, one dark
 * red ... and one silver, all transparent"). The red ones hold the stamps
 * until the client's own set arrives (give each its own list then); the
 * silver one holds the notebook.
 */
export const SUBFOLDERS: ReadonlyArray<Subfolder> = [
  { name: "Red", tint: "rgba(220, 20, 60, 0.55)", edge: "rgba(150, 8, 36, 0.85)", stamps: STAMPS },
  { name: "Dark red", tint: "rgba(110, 0, 28, 0.6)", edge: "rgba(56, 0, 14, 0.9)", stamps: STAMPS },
  // Clearer than the other two, so the notebook inside reads through its
  // front (client, 15 Oct: "increase the transparency a bit so the notebook
  // is a bit more noticeable"): a thinner tint, and less frost.
  { name: "Silver", tint: "rgba(205, 210, 218, 0.24)", edge: "rgba(132, 138, 148, 0.7)", frost: 2, stamps: [NOTEBOOK] },
];
