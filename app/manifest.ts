import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zuhayr Creative | Global Digital Marketing & AI Solutions",
    short_name: "Zuhayr Creative",
    description:
      "Elite digital marketing agency specializing in AI automation, web design, SEO optimization, and intelligent workflow systems.",
    start_url: "/",
    display: "standalone",
    background_color: "#470015",
    theme_color: "#470015",
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
        purpose: "any maskable",
      },
    ],
    orientation: "portrait-primary",
    categories: ["business", "productivity", "marketing"],
    lang: "en-US",
  };
}
