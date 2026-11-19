import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/seo";

/**
 * The pages search engines should index, at the address they are served
 * from (www; see app/lib/seo.ts). Only real, indexable routes belong here:
 * a URL that 404s or redirects makes Google trust the whole sitemap less.
 * /club is left out while it is a "coming soon" page marked noindex. Add a
 * page here when it is built.
 */
const PAGES: { path: string; changeFrequency: "weekly" | "monthly"; priority: number }[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/about", changeFrequency: "monthly", priority: 0.9 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.8 },
  { path: "/career", changeFrequency: "monthly", priority: 0.6 },
  { path: "/notes", changeFrequency: "monthly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  }));
}
