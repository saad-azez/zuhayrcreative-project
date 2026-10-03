/**
 * What the corner dock's glass folder holds: its coloured subfolders, and the
 * stamps inside each. Shared by the dock (CornerGlassDock) and the folder's
 * own sub dial (FolderSubDial), so swapping a stamp is one edit here.
 */

export interface Stamp {
  /** The art, painted contain-fit on the stamp's paper. */
  art: string;
  /** The paper's colour; cream when unset. */
  paper?: string;
  /** What the stamp shows, for the enlarged view's alt text. */
  label: string;
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
  { art: "/_next/image?url=%2Fhongkongmapicon.png&w=384&q=75", label: "Hong Kong" },
  { art: "/AI-9-cursor.png", label: "Zuhayr AI" },
];

export interface Subfolder {
  /** Its name, for the sub dial's buttons. */
  name: string;
  /** The translucent front. */
  tint: string;
  /** The back panel, showing as the folder's thickness. */
  edge: string;
  /** What it holds, back to front. */
  stamps: ReadonlyArray<Stamp>;
}

/**
 * The subfolders, in the brand's colours (client, 3 Oct: "one red, one dark
 * red ... and one silver, all transparent"). Each holds the stamps until the
 * client's own set arrives; give each its own list then.
 */
export const SUBFOLDERS: ReadonlyArray<Subfolder> = [
  { name: "Red", tint: "rgba(220, 20, 60, 0.55)", edge: "rgba(150, 8, 36, 0.85)", stamps: STAMPS },
  { name: "Dark red", tint: "rgba(110, 0, 28, 0.6)", edge: "rgba(56, 0, 14, 0.9)", stamps: STAMPS },
  { name: "Silver", tint: "rgba(205, 210, 218, 0.45)", edge: "rgba(132, 138, 148, 0.8)", stamps: STAMPS },
];
