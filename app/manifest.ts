import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zuhayr Creative | Design-led Creative & AI Agency",
    short_name: "Zuhayr Creative",
    description:
      "A design-led creative agency in Hong Kong: brand design, experience design, communication design, content production and AI integration.",
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
        purpose: "maskable",
      },
    ],
    orientation: "portrait-primary",
    categories: ["business", "productivity", "marketing"],
    lang: "en-US",
  };
}
