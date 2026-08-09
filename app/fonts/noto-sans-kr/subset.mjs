/**
 * Regenerates the subsetted Noto Sans KR files used by the hero language lens.
 *
 *   node app/fonts/noto-sans-kr/subset.mjs
 *
 * Run it after changing the I18N table in app/components/HeroBanner/HeroBanner.tsx.
 * Any character not in the font falls back to a system font, which reintroduces
 * the per-language typeface mismatch the font was added to fix.
 *
 * The character set is the CJK characters actually used plus the whole Latin
 * alphabet in both cases: Latin glyphs are cheap, and hard-coding only the
 * letters currently used is how the first cut of this font shipped without the
 * uppercase forms that `text-transform: uppercase` on the noun line needs —
 * "Colectivo" is painted as "COLECTIVO", so O, L, E, T, I and V were missing and
 * silently fell back to Arial. Spelling changes to the Spanish strings therefore
 * need no regeneration; new CJK characters do.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep in sync with I18N in app/components/HeroBanner/HeroBanner.tsx.
const REVEALS = {
  zh: ["是", "設計主導", "集體", "機構", "工作室"],
  ja: ["は", "デザイン主導", "コレクティブ", "エージェンシー", "ハウス"],
  ko: ["는", "디자인 주도", "컬렉티브", "에이전시", "하우스"],
  es: ["es un", "de diseño", "Colectivo", "Agencia", "Casa"],
};

const LATIN =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
  "áéíóúüñÁÉÍÓÚÜÑ¿¡-·&'";

const chars = new Set(LATIN);
for (const strings of Object.values(REVEALS)) {
  for (const s of strings) {
    for (const ch of s) {
      if (ch === " ") continue;
      chars.add(ch);
      // `uppercase` on the noun line means the uppercased form is what actually
      // gets painted; include both so either case works.
      chars.add(ch.toUpperCase());
      chars.add(ch.toLowerCase());
    }
  }
}
const text = [...chars].join("");

// A current-browser UA, or the API answers with TTF instead of WOFF2.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const here = path.dirname(fileURLToPath(import.meta.url));

// One request PER WEIGHT. Asking for `wght@400;700` in a single request returns
// the same Thin static for both, which leaves the bold noun line looking thin.
for (const weight of [400, 700]) {
  const api = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(api, { headers: { "User-Agent": UA } })).text();
  const url = css.match(/url\((https:[^)]+)\)/)?.[1];
  if (!url) throw new Error(`no font URL for weight ${weight}:\n${css}`);
  const buf = Buffer.from(
    await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer(),
  );
  const file = path.join(here, `NotoSansKR-subset-${weight}.woff2`);
  fs.writeFileSync(file, buf);
  console.log(`${path.basename(file)}  ${buf.length} bytes  (${chars.size} chars)`);
}

console.log(
  "\nNow verify by RENDERING, not by reading the CSS: the API's unicode-range\n" +
    "over-reports coverage. Hover the lens through all four languages and confirm\n" +
    "every reveal paints in Noto Sans KR alone, with no second family alongside.",
);
