import type { LiquidField } from "./liquidField";

/* The frost under a 3D glass icon (the cube, the folder's file, the
   envelope) is clipped to the icon's silhouette, traced from its rendered
   alpha after every blit. Traced at the alpha's outer edge, the frost
   showed past the glass: the rendered silhouette has a faint, wobbly
   fringe the eye does not read as glass, and the frost filled it — a
   lumpy pink halo round the folder (client, 8 Oct: "rendering issues").
   So the outline is SMOOTHED AND PULLED IN: the alpha is read as inside
   or out (capped at the faces' floor — the faces let most of the page
   through, so the shader keeps an alpha of 0.1 inside for this), averaged
   over a disc of GLASS_SOFT px, and called inside only where nearly all
   of that disc is. The frost's edge lands a couple of px in, under the
   glass's bright bevel, as a clean curve instead of the fringe's bumps. */
const GLASS_SOFT = 2.6;
const GLASS_FLOOR = 24;
const GLASS_KEEP = 0.86;
/* The disc's samples: its centre and two rings. */
const GLASS_TAPS: ReadonlyArray<readonly [number, number]> = (() => {
  const taps: [number, number][] = [[0, 0]];
  for (const [r, n] of [[GLASS_SOFT / 2, 6], [GLASS_SOFT, 12]] as const) {
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2 + (n === 6 ? Math.PI / 6 : 0);
      taps.push([Math.cos(t) * r, Math.sin(t) * r]);
    }
  }
  return taps;
})();
export function traceGlass(
  tracer: LiquidField,
  ctx: CanvasRenderingContext2D,
  px: number,
  cssPx: number
): string {
  const data = ctx.getImageData(0, 0, px, px).data;
  const s = px / cssPx;
  const n = GLASS_TAPS.length;
  const bar = GLASS_KEEP * GLASS_FLOOR * n;
  return tracer.pathOf((x, y) => {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      const ix = Math.min(px - 1, Math.max(0, Math.round((x + GLASS_TAPS[k][0]) * s)));
      const iy = Math.min(px - 1, Math.max(0, Math.round((y + GLASS_TAPS[k][1]) * s)));
      const a = data[(iy * px + ix) * 4 + 3];
      sum += a < GLASS_FLOOR ? a : GLASS_FLOOR;
    }
    return (bar - sum) / n;
  });
}
