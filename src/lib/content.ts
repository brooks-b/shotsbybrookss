/**
 * Build-time content access. Server components only: reads collection.json
 * files and the generated manifest from disk.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { thumbHashToRGBA } from "thumbhash";
import type { ChapterSummary, Frame, PlaceInfo, TravelStop } from "./frames";
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
  const manifest = JSON.parse(readFileSync(path.join(CONTENT, "manifest.json"), "utf8")) as Manifest;
  // Photos unchecked in `npm run review` stay in the manifest (so re-checking
  // one needs no re-upload) but never reach a page.
  const hidden = new Set(
    getCollections().flatMap((c) =>
      Object.entries(c.photos ?? {})
        .filter(([, o]) => o.hidden)
        .map(([file]) => `${c.slug}|${file.toLowerCase()}`),
    ),
  );
  return { ...manifest, photos: manifest.photos.filter((p) => !hidden.has(`${p.collection}|${p.file.toLowerCase()}`)) };
});

const yearOf = (c: Collection) => Number(c.dates.start.slice(0, 4));

/**
 * The colour a photo "feels" like, for the ambient tone: an average of its
 * thumbhash pixels weighted toward the saturated, mid-bright ones, so a
 * sunset reads orange and a forest reads green rather than averaging to mud.
 */
export function feltColor(thumbhash: string): string | undefined {
  if (!thumbhash) return undefined;
  const { rgba } = thumbHashToRGBA(Buffer.from(thumbhash, "base64"));
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const [pr, pg, pb] = [rgba[i], rgba[i + 1], rgba[i + 2]];
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    const sat = max === 0 ? 0 : (max - min) / max;
    const v = max / 255;
    const w = sat * sat * v * (1 - Math.abs(v - 0.6)) + 1e-4;
    r += pr * w;
    g += pg * w;
    b += pb * w;
    total += w;
  }
  return (
    "#" +
    [r, g, b]
      .map((c) =>
        Math.round(c / total)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

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
    thumbhash: p.thumbhash || undefined,
    tone: feltColor(p.thumbhash),
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
  // Withheld photos (people not yet cleared) are left out entirely.
  const photos = getManifest()
    .photos.filter((p) => p.collection === slug && !p.withheld && p.sources.webp.length > 0)
    .sort((a, b) => (a.exif.takenAt ?? a.file).localeCompare(b.exif.takenAt ?? b.file));

  if (photos.length > 0) return photos.map((p, i) => photoFrame(c, p, i + 1, photos.length));

  // Editions borrow their frames from other chapters, numbered within the edition.
  if (c.kind === "edition" && c.picks?.length) {
    const byKey = new Map(
      getCollections()
        .filter((x) => x.kind === "place")
        .flatMap((x) => getFrames(x.slug))
        .map((f) => [f.key, f]),
    );
    const picked = c.picks.map((id) => byKey.get(id)).filter((f): f is Frame => f?.kind === "photo");
    if (picked.length > 0) return picked.map((f, i) => ({ ...f, index: i + 1, total: picked.length }));
  }

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

/**
 * Photos for the globe readout card, keyed "slug|stop": the chapter cover if
 * it was taken at that stop, otherwise the first photo from the stop. Also
 * keyed by bare slug for stops with no photo of their own.
 */
export function getPhotoCovers(): Record<string, Frame> {
  const out: Record<string, Frame> = {};
  for (const c of getChapters()) {
    if (c.kind !== "place") continue;
    if (c.cover.kind === "photo") out[c.slug] = c.cover;
    const photos = getFrames(c.slug).filter((f) => f.kind === "photo");
    for (const s of c.stops) {
      const pick =
        c.cover.kind === "photo" && c.cover.stop === s.name ? c.cover : photos.find((f) => f.stop === s.name);
      if (pick) out[`${c.slug}|${s.name}`] = pick;
    }
  }
  return out;
}

/** "Selected works": the Top 10 edition's frames. */
export function getSelectedWorks(): Frame[] {
  const edition = getCollections().find((c) => c.kind === "edition");
  if (!edition) return [];
  return getFrames(edition.slug);
}

/** The newest chapter cover that is a real photo, for the site-wide share card. */
export function getHomeCover(): Frame | undefined {
  return [...getChapters()].reverse().find((c) => c.cover.kind === "photo")?.cover;
}

/**
 * Photos for the opening contact sheet: one from each chapter in turn, newest
 * trips first, so the wall mixes places and colours instead of clumping.
 */
export function getMosaicFrames(count = 32): Frame[] {
  const pools = [...getChapters()]
    .reverse()
    .filter((c) => c.kind === "place")
    .map((c) => getFrames(c.slug).filter((f) => f.kind === "photo"))
    .filter((pool) => pool.length > 0);
  const out: Frame[] = [];
  for (let round = 0; out.length < count && pools.some((p) => p.length > round); round++) {
    for (const pool of pools) {
      // Walk each chapter at a stride, so a long chapter shows its range, not just its first day.
      const stride = Math.max(1, Math.floor(pool.length / 4));
      const f = pool[(round * stride) % pool.length];
      if (round * stride < pool.length * 2 && f && !out.includes(f)) out.push(f);
      if (out.length >= count) break;
    }
  }
  return out;
}

/**
 * Photos chosen as the arrival backdrop for a place, where a different shot
 * suits its atmosphere better than the cover (dusk for Wyoming's stars,
 * sunset for Bangkok's lanterns).
 */
const BACKDROPS: Record<string, string> = {
  wyoming: "dscf0495",
  bangkok: "dscf2366",
  japan: "dscf2035",
  rwanda: "dscf2697",
};

/** Every place on the globe, in travel order, ready for the destination board. */
export function getPlaces(): PlaceInfo[] {
  const covers = getPhotoCovers();
  return getChapters()
    .filter((c) => c.kind === "place" && !c.locationPending)
    .map((c) => {
      const frames = getFrames(c.slug);
      const photos = frames.filter((f) => f.kind === "photo");
      const stops = getTravelStops().filter((s) => s.slug === c.slug);
      const cover = c.cover.kind === "photo" ? c.cover : undefined;
      const backdrop = photos.find((f) => BACKDROPS[c.slug] && f.key.endsWith(BACKDROPS[c.slug])) ?? cover;
      return {
        slug: c.slug,
        title: c.title,
        subtitle: c.subtitle,
        year: Number(c.dates.start.slice(0, 4)),
        dates: c.dates,
        region: c.region,
        cover,
        backdrop,
        frames: photos.length,
        cities: stops.map((s) => ({
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          tz: s.tz,
          frames: s.frames,
          photo: covers[`${c.slug}|${s.name}`],
        })),
      };
    });
}
