# The 3D shop ("Paint to Pixel")

The client's atelier window, from their `atelier-full` project as it arrived on
12 Oct. It is their code, still in progress on their side: this folder is a
copy that the next drop replaces, with the changes listed below re-applied.

It is NOT part of the Next app. It is its own small project, built into one
self-contained module that the site loads at run time:

    shop/                          this folder: source, lockfile, build config
    public/shop/shop-window.js     the built module (React, three, fiber, drei, post-processing inside)
    public/shop/…                  the assets it loads (textures, HDRI, fonts, posters, logos)
    app/components/shopEmbed.tsx   how the site loads it, and who gets it live
    app/components/HeroShop.tsx    where it is mounted now: in the hero
    app/components/ShopSection.tsx the other placement, a section of its own (switched off)

The site's `tsconfig.json` and `eslint.config.mjs` leave this folder out: it has
its own compiler settings and its own library versions.

## Build

    cd shop
    npm ci --ignore-scripts
    npm run build:lib          # typechecks, then writes ../public/shop/shop-window.js

`package-lock.json` is the client's, unchanged, so the module is built from
exactly the versions the scene was written against (three 0.169, fiber 9.8.1,
drei 10.7.9, postprocessing 6.39.5).

## Why a separate module, and not compiled into the app

The site runs three 0.184; the scene is pinned to 0.169. Compiled into the app
(the route the client's own `embed/next/ShopWindowSection.tsx` takes) it ran on
0.184, and that is not the same window: three 0.184 has dropped the soft shadow
filter the scene asks for (`PCFSoftShadowMap has been deprecated. Using
PCFShadowMap instead`), and the scene ran about a fifth slower on it (59 frames
a second for the client's project on its own; 47 with only three changed).

A module with its own three draws what the client's project draws, and leaves
the site's dependencies exactly as they were. It also settles a file-name
clash: `src/layout.ts` (the scene's placements) anywhere under `app/` is read
by Next as a route layout and fails the build.

## What differs from the client's source

`src/` is their `src/` without the standalone page's entry points (`main.tsx`,
`App.tsx`) and the dev-only wall-drawing tool (`wall/`); `data/` is their
`data/`. Their `dist-embed/` was not used: it was built at 10:21 on 11 Oct and
`src/` was edited until 19:29 that day, so it lacked the props, the seasons
rail, the squirt interaction and the swatch card.

Added: `embed.tsx` (the `mountShop` entry), `vite.lib.config.ts`,
`tools/optimize-textures.mjs`, `src/lib/prepare.ts`, `src/lib/hostScroll.ts`,
`src/lib/sharedMaterial.ts`, this file.

Changed in their files:

| File | Change | Why |
| --- | --- | --- |
| `src/scene/MirrorWall.tsx` | `logoTexture('zc-full')` is `'zc-wordmark'`, and its plane takes the wordmark's aspect (3.85 : 1, it was square) | Unfinished rename: `src/lib/logoTexture.ts`, the last file edited, no longer has the old ids. The scene did not typecheck, and the logo lookup threw at run time. |
| `src/scene/tubes/labelTexture.ts` | `'zc-full'` is `'zc-wordmark'`, `'zc-z'` is `'zc-mark'` | The same rename. |
| `src/lib/assets.ts`, `src/scene/tubes/Tubes.tsx` | Scans and prints load from `tex/2k/`, seven of them from `tex/1k/` | Textures, below. |
| `src/scene/Lights.tsx`, `src/scene/WallChips.tsx`, `src/scene/props/FanDeck.tsx` | Constant materials written once and shared (`sharedMaterial`) instead of one JSX copy per mesh | Frame cost, below. Same pixels. |
| `src/scene/Room.tsx` | The floor's reflector material is given its `USE_UV` define from the start | Start-up, below: without it the floor's shader was built twice. |
| `src/ShopWindow.tsx` | `Prepare` and `WarmUp` (start-up), `Drive` and the pacing ladder (the `half` and `still` states), the `approach` and `yieldToScroll` props | Start-up and Pacing, below. |

## Start-up

This was the lag. Left alone, the scene paid for itself inside the first frames
it drew, and the page it sits in paid with it: nothing on the page scrolls or
answers a click while a frame is being drawn.

Measured on a desktop (i5-12400F, RTX 4060), the first time the window came
near the screen the page stopped for **12 to 14 seconds in one piece**. Nearly
all of it was three.js building each material's shader program the first time
it drew with it and waiting for the GPU to finish before going on to the next:
about ninety programs, one after another. The rest was looking up each
program's uniforms (some thirty thousand small synchronous calls) and uploading
textures, all in the same frames.

Now none of that is left for a frame to do:

- **`src/lib/prepare.ts`**, run once the assets are in and before anything is
  drawn. It hands every program to the driver ahead of time, which builds them
  in parallel on its own threads while the page stays free; then it does the
  uniform lookups, the texture uploads and each object's first draw a few at a
  time, giving the page its turn in between. The file's header says how each
  family of programs (the scene's, the shadow pass's, the clipped ones, the
  post-processing passes') is built under the conditions it will later be
  asked for under, which is what makes the renderer recognise them instead of
  building them again.
- **`WarmUp`** in `ShopWindow.tsx`. A few programs are only asked for once
  things are moving (the voxels get their colours a second in, for one). Before
  the window is first shown it is stepped once through its whole loop, behind
  its poster and only while the page is not scrolling. Off screen there is no
  hurry; on screen (the hero) it is given six seconds and then shown as it is.
- As a section, the site starts all this two and a half screens ahead
  (`approach`), so it is done by the time the window is reached. In the hero
  it starts a beat after the loader's curtain is off.

Measured again, in the hero: the window is live about 14 s after the curtain
lifts (it is its poster until then), and in that time the page is paused a
dozen times for 0.1 to 0.3 s and once for about 0.7 s (the composer's and the
reflections' buffers being made), where it used to stop for 12 to 14 s. Once
live: no pause.

One thing found the hard way, in case this is touched again: the throwaway
objects programs are built against must be NEW objects. Made as objects that
inherit from the real meshes (`Object.create`), they left the engine unable to
optimise those meshes, and every frame afterwards cost twice as much.

## Textures

The scans arrived as 4K KTX2 (UASTC, RDO, Zstandard at its highest level):
270 MB, already as small as that encoding goes. The site ships 45 MB, and none
of it is a re-encode.

A KTX2 file carries the whole mip chain: the 4096 px image and, under it, the
2048, 1024, … versions the encoder made from it. `tools/optimize-textures.mjs`
writes a smaller file by taking the top level (or two) off and carrying every
level below over byte for byte; it reads each one back, compares hashes, and
stops if one differs. Nothing is decoded, resized or compressed again.

It is safe because the top level is not what reaches the screen. The camera is
held back from the window, and at any distance it can reach the GPU is already
sampling a smaller level. Checked, not assumed: the same frozen frame rendered
from the client's source with their 4K files and from this folder with the
site's files, on a 3840 x 2160 canvas, at the hero view and at five close-ups
nearer than the orbit allows.

| View | PSNR | Pixels off by more than 2/255 | by more than 8/255 |
| --- | --- | --- | --- |
| hero | 71 dB | 0.01 % | 0 |
| tubes | 54 dB | 0.26 % | 0.002 % |
| floor and turntable | 54 dB | 0.30 % | 0.008 % |
| paper wall | 53 dB | 0.50 % | 0.002 % |
| desk props | 54 dB | 0.72 % | 0.027 % |
| picture frame | 57 dB | 0.36 % | 0.006 % |

(Above about 50 dB a difference cannot be seen. Everything at 1K was tried too:
15 MB, still 65 dB at the hero view, but 42 to 46 dB in the close-ups, a
softening that can be found on a high-density screen zoomed right in. So only
the maps below went that far.)

What the set is:

- `public/shop/tex/2k/`, 14 files: the colour and normal maps of everything
  large (marble, paper, foil, the box's metal) and the tube prints.
- `public/shop/tex/1k/`, 7 files: the wood of the pencils and brush handles
  (`ash_veneer`, all three maps), which are a few centimetres on screen, and
  the roughness maps of `Marble003`, `Metal032`, `Foil003` and `Paper001`,
  which only shape a highlight. The list is `AT_1K` in `src/lib/assets.ts`.
- `public/shop/tex/4k/wall_ink.ktx2` stays 4K. It is 1 MB, and it is one
  drawing stretched over the whole back wall, not a tile, so it is the one
  texture whose top level is used.
- `Plaster001` (41 MB) is not shipped: nothing in the source loads it.

**The paper wall on Windows.** `Paper001` is 4096 x 2402. Neither 2402 nor its
half is a multiple of four, and a desktop GPU's compressed format (BC7)
refuses such a texture: with the files as they arrived the paper wall, the
roll and the fan deck drew dark on Windows (it is fine on Apple GPUs, which
take a different format). The tool crops the level it keeps to whole 4 x 4
blocks (2048 x 1200), one real pixel row. The wall now draws as on the poster.

To redo the set from a new drop:

    node tools/optimize-textures.mjs <their public/tex/4k> ../public/shop/tex/2k --only <the 14 names>
    node tools/optimize-textures.mjs <their public/tex/4k> ../public/shop/tex/1k --only <the 7 names> --drop 2

## Frame cost

Once running, the scene is limited by the processor, not the graphics card. On
the desktop above it spends 10 to 13 ms of script in every frame, of a 16.7 ms
budget at 60 fps: some 350 meshes, each drawn in the window, again in the
mirror and again in the floor's reflection, with a physical material and ten
spot lights' worth of uniforms to send each time. It holds 60 there with little
to spare; a slower processor will not.

One cause is that the same look is written out as JSX on each mesh that wears
it, which makes a separate material every time: the scene arrived with 221
materials for about a hundred distinct looks. Sharing every identical one was
tried at run time and took the dev build from 15.3 to 13.0 ms a frame with the
same pixels. Here it is done where the values are plain constants and the
copies were many (the lamp hardware, the wall chips, the fan deck): 158
materials now. The 48 spare copies left are mostly the chrome trims, written
once per component across seven files, and the box-metal panels; they are the
client's to merge. Beyond that the cost is the number of things drawn, which
is the design.

## Pacing

`ShopWindow` already lowered the pixel ratio under load. The rest of this is
added. The window's frames are asked for by one component, `Drive`, at full
rate or at half; the frame loop itself is never switched, because switching it
restarts the scene's clock and the loop would jump back to its first frame.

- **Yielding to scroll** (`yieldToScroll`, which the site sets). While the
  page is scrolling, and for a moment after, the window is drawn on every
  second refresh and the page has the others. Measured: 10.5 ms of script a
  frame at rest, 5.5 while scrolling.
- **Half rate** for a machine that cannot keep up. It is taken when the pixel
  ratio is already 1 and the library's monitor reports under 40 frames a
  second, or when a quarter of the display's refreshes run late over two
  4-second windows (the monitor says nothing between 40 and 60, which is where
  a page feels slow). Thirty frames a second, evenly; the loop is a function
  of the clock, so it plays at the same speed. After 20 s of a steady display
  it gets one try at full rate again.
- **Still.** If the drawn frames are taking three refreshes or more, thirty is
  out of reach too, and the canvas fades back to the poster.

No step is taken in the window's first 8 s on screen, around a scroll, or
while it is being warmed up.

What this cannot do: on a processor half again as slow as the desktop above, a
frame of the scene takes about 20 ms, and at half rate that frame still
overruns its refresh. The hero then runs at 40 to 47 refreshes a second with
the window live. Nothing short of a lighter scene changes that; the ladder
only makes it even, and stops it altogether when it is hopeless. Not tried on
a phone or a slow laptop.

Two things were tried for the frame cost and left out, because each changes
the picture a little for a small gain: turning off the ambient occlusion's
extra passes for transparent objects (3 % less script; the laptop's screen
dims slightly) and skipping the wall mirror's second render inside the floor's
reflection (9 % less; the mirror's patch in the floor's reflection changes).

## Known, and not fixed here

- Picking another region on the seasons rail stops the page for about half a
  second: its 2000 px print is uploaded to the GPU at that moment
  (`RegionPaint.tsx`, `new Texture(img)`). Only the first region is uploaded
  ahead of time.
- The wheel zooms the window only after a drag, by the scene's own rule, but
  the site's smooth scroll takes the wheel as well, so the page moves with it.
- 61 MB is still a great deal to send for one section. Going lower means
  re-encoding the scans at a lower quality, which changes pixels and is the
  client's call.
