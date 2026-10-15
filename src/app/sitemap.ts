import type { MetadataRoute } from "next";
import { getChapters } from "@/lib/content";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/archive", "/colophon", "/about"].map((p) => ({
    url: `${site.url}${p}`,
    changeFrequency: "monthly" as const,
    priority: p === "" ? 1 : 0.6,
  }));
  const chapters = getChapters().map((c) => ({
    url: `${site.url}/chapters/${c.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  return [...pages, ...chapters];
}
