// Stands in for the notebook viewer's texture worker (texWorker-*.js).
//
// The real worker paints every material pixel by pixel on each visit (4 s on a fast computer, 22-55 s on an iPhone),
// and the viewer draws nothing until it is done. Those pictures are the same every time, so
// tools/bake-notebook-textures.mjs painted them once into ../baked/<set>/. This fetches them and posts the viewer the
// same messages the worker would: {key, value} per material, ImageBitmaps where the worker sent them, then {done}.
// A material that fails to arrive is simply not sent; the viewer paints whatever is missing itself, as it does when
// there is no worker at all. Written by hand, not part of the export: its source is tools/notebook-texBaked.js, and
// prepare-notebook.mjs copies it here and points the viewer at it.
const PHONE =
  /Android|iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const BASE = new URL(`../baked/${PHONE ? "phone" : "desktop"}/`, import.meta.url);

const bitmap = async (file) => {
  const res = await fetch(new URL(file, BASE));
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  // No colour management: the normal and roughness maps are data, and the worker's bitmaps were never converted.
  return createImageBitmap(await res.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
};

const build = async (v, transfer) => {
  if (Array.isArray(v)) return Promise.all(v.map((x) => build(x, transfer)));
  if (v && typeof v === "object") {
    if ("$img" in v) {
      const b = await bitmap(v.$img);
      transfer.push(b);
      return b;
    }
    const o = {};
    await Promise.all(Object.entries(v).map(async ([k, x]) => (o[k] = await build(x, transfer))));
    return o;
  }
  return v;
};

let manifest = null;
self.onmessage = async (e) => {
  const keys = e.data;
  try {
    manifest ??= await (await fetch(new URL("manifest.json", BASE))).json();
  } catch {
    self.postMessage({ done: true });
    return;
  }
  await Promise.all(
    keys.map(async (key) => {
      const entry = manifest.find((m) => m.key === key);
      if (!entry) return;
      try {
        const transfer = [];
        const value = await build(entry.value, transfer);
        self.postMessage({ key, value }, transfer);
      } catch {
        /* left to the viewer to paint */
      }
    }),
  );
  self.postMessage({ done: true });
};
