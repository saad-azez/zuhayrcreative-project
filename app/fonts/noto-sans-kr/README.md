# Noto Sans KR — subsetted for the hero language lens

Licensed under the **SIL Open Font License 1.1** — see `LICENSE.txt`, which must
stay next to these files. (The copyright reads Adobe / "Source" because Google's
Noto Sans KR is built from Source Han Sans.)

| file | weight | used by |
| --- | --- | --- |
| `NotoSansKR-subset-400.woff2` | 400 | line 2 of the hero headline ("is a design-led") |
| `NotoSansKR-subset-700.woff2` | 700 | line 3, the cycling noun |

Registered in `app/layout.tsx` as `--font-reveal`.

## Why this font is here

The hero's logo-shaped lens reveals the headline in Chinese, Japanese, Korean and
Spanish, and all four are meant to share one typeface. No system font manages
that: **no installed family covers Han + kana + Hangul together.** Left to system
fonts on Windows, Chinese and Japanese resolved to Yu Gothic — a *Japanese* face
drawing Traditional Chinese, so 體/機/構 came out with Japanese glyph forms — and
Korean to Malgun Gothic, so the lens changed typeface depending on which language
it happened to be showing. `디자인 주도` was even split across two fonts inside a
single string.

Noto Sans KR covers all three scripts plus the Latin the Spanish reveal needs, so
one file family serves every language.

## Regenerating after an I18N change

**These files contain only the 64 characters the reveal strings currently use.**
That subsetting is what keeps a CJK face at ~40KB per weight instead of megabytes
— but it also means any new character added to `I18N` in
`app/components/HeroBanner/HeroBanner.tsx` will **not** be in the font and will
silently fall back to a system font, reintroducing the mismatch this font exists
to fix.

After editing those strings, rebuild the character set and refetch:

1. Collect every character used by the non-English entries in `I18N` (drop
   spaces, de-duplicate).
2. Fetch a subset per weight from the Google Fonts API, which takes the exact
   characters in `text=`:

   ```
   https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400&text=<CHARS>
   https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=<CHARS>
   ```

   Send a current-browser `User-Agent` or the API returns TTF instead of WOFF2.
   Each response is a single `@font-face`; download the file it points at and
   save it over the matching file here.

3. Verify coverage by **rendering**, not by reading the response. The
   `unicode-range` in that CSS lists characters the font does not necessarily
   contain — during this font's selection, `Noto Sans TC` advertised the Korean
   range and then had no Hangul in the file at all. Load the page, hover the
   lens through all four languages, and confirm in DevTools (Rendering →
   "platform fonts", or `CSS.getPlatformFontsForNode` over CDP) that every
   reveal reports `Noto Sans KR` alone, with no second family beside it.

Ask for both weights **separately**, one request each. Asking for
`wght@400;700` in one request returns the same *Thin* static file for both, which
leaves the bold line looking thin.
