import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zuhayr Creative | Global Digital Marketing & AI Solutions",
    short_name: "Zuhayr Creative",
    description:
      "Elite digital marketing agency specializing in AI automation, web design, SEO optimization, and intelligent workflow systems.",
    start_url: "/",
    display: "standalone",
    // Both held equal to --page-edge in globals.css (and to `themeColor` in
    // layout.tsx). background_color is the splash colour an installed web app
    // paints before first render; theme_color tints its window chrome. A value
    // that disagreed with the page's own edge colour showed up as a flash on
    // launch and as a mismatched bar on the platforms that still read it.
    background_color: "#1a070d",
    theme_color: "#1a070d",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    orientation: "portrait-primary",
    categories: ["business", "productivity", "marketing"],
    lang: "en-US",
  };
}
