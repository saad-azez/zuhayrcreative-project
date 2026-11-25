# Fusion Pixel 12px — subsetted for the hero language lens

Licensed under the **SIL Open Font License 1.1**, see `LICENSE.txt`, which must
stay next to these files. Source: https://github.com/TakWolf/fusion-pixel-font
(release 2026.11.10, `12px-monospaced`, `otf.woff2`).

| file | built from | used for |
| --- | --- | --- |
| `FusionPixel12-zh-subset.woff2` | `fusion-pixel-12px-monospaced-zh_hk` | Chinese (Traditional, Hong Kong forms) |
| `FusionPixel12-ja-subset.woff2` | `fusion-pixel-12px-monospaced-ja` | Japanese |
| `FusionPixel12-ko-subset.woff2` | `fusion-pixel-12px-monospaced-ko` | Korean |

Registered in `app/layout.tsx` as `--font-pixel-zh`, `--font-pixel-ja`,
`--font-pixel-ko`; picked per language by `revealFont()` in
`app/components/HeroBanner/HeroBanner.tsx`. Spanish uses the English word's own
face (Departure Mono / Doto), so it needs nothing here.

## Why

The hero's English is pixel type (Departure Mono, Doto). Its translations were
set in Noto Sans KR, a smooth sans, and read as a different font in the lens.
Neither pixel face has Han, kana or Hangul; Fusion Pixel is a pixel face that
does, in each language's own glyph forms.

## Each file holds ONLY the characters the lens strings use

Change a zh/ja/ko string in `I18N` and rebuild that language's file, or the new
characters fall back to Noto:

    pip install fonttools brotli
    pyftsubset fusion-pixel-12px-monospaced-<src>.otf.woff2 \
      --text="<every character of that language's strings> " \
      --flavor=woff2 --layout-features='*' \
      --output-file=FusionPixel12-<lang>-subset.woff2
