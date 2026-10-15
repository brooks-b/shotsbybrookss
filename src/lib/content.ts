/**
 * Build-time content access. Server components only: reads collection.json
 * files and the generated manifest from disk.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { thumbHashToDataURL } from "thumbhash";
import type { ChapterSummary, Frame, TravelStop } from "./frames";
import type { Collection, Manifest, Photo } from "./types";

const CONTENT = path.join(process.cwd(), "content");

export const getCollections = cache((): Collection[] => {
  const dir = path.join(CONTENT, "collections");
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => JSON.parse(readFileSync(path.join(dir, d.name, "collection.json"), "utf8")) as Collection)
    .sort((a, b) => a.order - b.order);
});

export const getManifest = cache((): Manifest => {
  return JSON.parse(readFileSync(path.join(CONTENT, "manifest.json"), "utf8")) as Manifest;
});

const yearOf = (c: Collection) => Number(c.dates.start.slice(0, 4));

const srcset = (sources: { width: number; url: string }[]) => sources.map((s) => `${s.url} ${s.width}w`).join(", ");

function photoFrame(c: Collection, p: Photo, index: number, total: number): Frame {
  const base = {
    key: p.id,
    collection: c.slug,
    collectionTitle: c.title,
    index,
    total,
    width: p.width,
    height: p.height,
    color: p.color,
    exif: p.exif,
    stop: p.stop,
    year: p.exif.takenAt ? Number(p.exif.takenAt.slice(0, 4)) : yearOf(c),
  };
  if (p.withheld || p.sources.webp.length === 0) {
    return { ...base, kind: "withheld", alt: "Photo withheld until the people in it are cleared", exif: null };
  }
  return {
    ...base,
    kind: "photo",
    alt: p.alt || `${c.title}, frame ${index}`,
    blur: p.thumbhash ? thumbHashToDataURL(Buffer.from(p.thumbhash, "base64")) : undefined,
    avif: srcset(p.sources.avif),
    webp: srcset(p.sources.webp),
    src: p.sources.webp.at(-1)?.url,
  };
}

function placeholderFrame(c: Collection, index: number, total: number): Frame {
  return {
    key: `${c.slug}-placeholder-${index}`,
    kind: "placeholder",
    collection: c.slug,
    collectionTitle: c.title,
    index,
    total,
    width: 4,
    height: 5,
    alt: `${c.title}, frame ${index} (placeholder)`,
    color: "#151411",
    exif: null,
    stop: c.stops[(index - 1) % Math.max(c.stops.length, 1)]?.name,
    year: yearOf(c),
  };
}

/** Every frame in a chapter, in display order. */
export const getFrames = cache((slug: string): Frame[] => {
  const c = getCollections().find((x) => x.slug === slug);
  if (!c) return [];
  const photos = getManifest()
    .photos.filter((p) => p.collection === slug)
    .sort((a, b) => (a.exif.takenAt ?? a.file).localeCompare(b.exif.takenAt ?? b.file));

  if (photos.length > 0) return photos.map((p, i) => photoFrame(c, p, i + 1, photos.length));
  const n = c.placeholders ?? 1;
  return Array.from({ length: n }, (_, i) => placeholderFrame(c, i + 1, n));
});

export function getCover(c: Collection): Frame {
  const frames = getFrames(c.slug);
  const chosen = c.cover
    ? frames.find((f) => f.key.endsWith(c.cover!.toLowerCase().replace(/\.[^.]+$/, "")))
    : undefined;
  return chosen ?? frames.find((f) => f.kind !== "withheld") ?? frames[0];
}

export const getChapters = cache((): ChapterSummary[] =>
  getCollections().map((c) => {
    const frames = getFrames(c.slug);
    return {
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      kind: c.kind,
      region: c.region,
      stops: c.stops,
      dates: c.dates,
      datesApprox: Boolean(c.datesApprox),
      locationPending: Boolean(c.locationPending),
      note: c.note,
      order: c.order,
      frames: frames.length,
      years: [...new Set(frames.map((f) => f.year))].sort(),
      cover: getCover(c),
    };
  }),
);

export function getChapter(slug: string) {
  return getChapters().find((c) => c.slug === slug);
}

/** Every stop on the globe, in travel order. */
export const getTravelStops = cache((): TravelStop[] => {
  let seq = 0;
  return getChapters()
    .filter((c) => c.kind === "place" && !c.locationPending)
    .flatMap((c) =>
      c.stops.map((s) => ({
        ...s,
        slug: c.slug,
        chapter: c.title,
        region: c.region,
        year: Number(c.dates.start.slice(0, 4)),
        frames: getFrames(c.slug).filter((f) => !f.stop || f.stop === s.name || c.stops.length === 1).length,
        seq: seq++,
      })),
    );
});

export const getAllFrames = cache((): Frame[] =>
  getCollections()
    .filter((c) => c.kind === "place")
    .flatMap((c) => getFrames(c.slug)),
);

/** Chapter covers that are real photos, keyed by slug. Shown in the globe readout. */
export function getPhotoCovers(): Record<string, Frame> {
  return Object.fromEntries(
    getChapters()
      .filter((c) => c.cover.kind === "photo")
      .map((c) => [c.slug, c.cover]),
  );
}

/** "Selected works": the Top 10 edition's frames. */
export function getSelectedWorks(): Frame[] {
  const edition = getCollections().find((c) => c.kind === "edition");
  if (!edition) return [];
  const all = new Map(getAllFrames().map((f) => [f.key, f]));
  const picked = (edition.picks ?? []).map((id) => all.get(id)).filter((f): f is Frame => Boolean(f));
  return picked.length > 0 ? picked : getFrames(edition.slug);
}

/** The newest chapter cover that is a real photo, for the site-wide share card. */
export function getHomeCover(): Frame | undefined {
  return [...getChapters()].reverse().find((c) => c.cover.kind === "photo")?.cover;
}
