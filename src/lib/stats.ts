/**
 * Numbers for the colophon. Two sources, neither hand-typed:
 *  - content/manifest.json, written by `npm run ingest`
 *  - src/data/build-stats.json, written by `npm run stats` (build time + Lighthouse)
 */
import buildStats from "@/data/build-stats.json";
import { getAllFrames, getChapters, getManifest } from "./content";

export type Lighthouse = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  formFactor: "mobile" | "desktop";
  url: string;
};

type BuildStatsFile = {
  generatedAt: string | null;
  buildSeconds: number | null;
  routes: number | null;
  firstLoadJsKb: number | null;
  lighthouse: { mobile: Lighthouse; desktop: Lighthouse } | null;
};

export function getBuildStats() {
  const manifest = getManifest();
  const file = buildStats as BuildStatsFile;
  return {
    photos: manifest.stats.photos,
    frames: getAllFrames().length,
    chapters: getChapters().length,
    derivatives: manifest.stats.derivatives,
    bytesOriginal: manifest.stats.bytesOriginal,
    bytesDerivatives: manifest.stats.bytesDerivatives,
    bytesSaved: manifest.stats.bytesSaved,
    manifestGeneratedAt: manifest.generatedAt,
    statsGeneratedAt: file.generatedAt,
    buildSeconds: file.buildSeconds,
    routes: file.routes,
    firstLoadJsKb: file.firstLoadJsKb,
    lighthouse: file.lighthouse?.mobile ?? null,
    lighthouseDesktop: file.lighthouse?.desktop ?? null,
  };
}
