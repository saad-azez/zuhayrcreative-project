# Façade

Display typeface by Éléonore Fines, published by [Velvetyne (VTF)](https://velvetyne.fr/fonts/facade/).
Built from the architectural grid of the ÉSAD Orléans façade.

Licensed under the **SIL Open Font License 1.1** — see `LICENSE.txt`, which must
stay next to these files. The OFL permits use, modification and redistribution
(including bundling in a website) provided the licence travels with the font and
the font itself is not sold on its own.

## The four cuts are STYLES, not weights

`Sud` (South) is the cut that stays faithful to the architecture; `Ouest` (West),
`Est` (East) and `Sud-Ouest` (South West) each depart from it in a different way.
They are separate designs at a single weight, so they must be registered as
separate families — declaring them as weights of one family would let the browser
pick or synthesise the wrong one.

| file | cut | wired up as |
| --- | --- | --- |
| `Facade-Sud.woff` | Sud — faithful to the grid | `--font-facade` |
| `Facade-Ouest.woff` | Ouest | available, not registered |
| `Facade-Est.woff` | Est | available, not registered |
| `Facade-Sud-Ouest.woff` | Sud-Ouest | available, not registered |
| `FacadeGX.ttf` | variable source spanning the cuts | available, not registered |

Only `Sud` is registered in `app/layout.tsx`. Switching cuts is a one-line change
to the `src` there; the other files are already in the repo for that reason.

## It is a display face

The letterforms are modular and heavily stylised (see the specimen in the
upstream repo). It reads well large — headings, the wordmark, numerals — and
badly at paragraph sizes. Body copy should stay on Geist.
