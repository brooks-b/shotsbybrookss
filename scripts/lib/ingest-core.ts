import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Sharp } from "sharp";
import { rgbaToThumbHash } from "thumbhash";
import { readExif } from "../../src/lib/exif/read";
import { distanceKm, toCityLevel } from "../../src/lib/geo";
import type { Collection, Manifest, Photo } from "../../src/lib/types";
import type { Storage } from "./storage";

/** Derivative widths. 2560 is the ceiling: nothing larger is ever published. */
export const WIDTHS = [480, 960, 1440, 1920, 2560] as const;
export const MAX_WIDTH = 2560;

const PHOTO_EXT = /\.(jpe?g|png|tiff?|webp|heic)$/i;
/** Photos closer than this to a collection stop are assigned to it. */
const STOP_RADIUS_KM = 120;

export type IngestSummary = {
  added: string[];
  updated: string[];
  unchanged: string[];
  removed: string[];
  withheld: string[];
  missingLocation: string[];
  missingAlt: string[];
};

export type IngestOptions = {
  /** Folder that holds `collections/` and `manifest.json`. */
  contentDir: string;
  storage: Storage | null;
  log?: (line: string) => void;
};

export async function loadCollections(contentDir: string): Promise<Collection[]> {
  const dir = path.join(contentDir, "collections");
  const slugs = (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory());
  const collections = await Promise.all(
    slugs.map(async (d) => {
      const json = await readFile(path.join(dir, d.name, "collection.json"), "utf8");
      return JSON.parse(json) as Collection;
    }),
  );
  return collections.sort((a, b) => a.order - b.order);
}

async function loadManifest(contentDir: string): Promise<Manifest | null> {
  try {
    return JSON.parse(await readFile(path.join(contentDir, "manifest.json"), "utf8")) as Manifest;
  } catch {
    return null;
  }
}

export function photoId(collection: string, file: string) {
  return `${collection}-${path.parse(file).name}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

function isWithheld(collection: Collection, people: boolean | undefined) {
  const shows = people ?? collection.people?.contains ?? false;
  return shows && !collection.people?.cleared;
}

async function thumbhashOf(image: Sharp) {
  const { data, info } = await image
    .clone()
    .resize(100, 100, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString("base64");
}

async function dominantColor(image: Sharp) {
  const { dominant } = await image.clone().stats();
  return "#" + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Picks the stop a photo belongs to, from its (rounded) GPS or an override. */
function locate(
  collection: Collection,
  gps: { lat: number; lng: number } | undefined,
  stopOverride: string | undefined,
): Pick<Photo, "stop" | "coords"> {
  if (stopOverride) {
    const stop = collection.stops.find((s) => s.name === stopOverride);
    if (stop) return { stop: stop.name, coords: toCityLevel(stop) };
  }
  if (gps) {
    const coords = toCityLevel(gps);
    const nearest = collection.stops.map((s) => ({ s, d: distanceKm(gps, s) })).sort((a, b) => a.d - b.d)[0];
    return { coords, stop: nearest && nearest.d < STOP_RADIUS_KM ? nearest.s.name : undefined };
  }
  if (collection.stops.length === 1) {
    return { stop: collection.stops[0].name, coords: toCityLevel(collection.stops[0]) };
  }
  return {};
}

async function processPhoto(
  collection: Collection,
  file: string,
  buf: Buffer,
  hash: string,
  previous: Photo | undefined,
  storage: Storage | null,
): Promise<Photo> {
  const id = photoId(collection.slug, file);
  const { exif, gps } = await readExif(buf);

  // .rotate() applies the EXIF orientation. sharp drops all metadata on
  // output unless asked to keep it, so EXIF and GPS never reach public files.
  const image = sharp(buf, { failOn: "none" }).rotate();
  const oriented = await image.clone().toBuffer({ resolveWithObject: true });
  const { width, height } = oriented.info;

  const people = previous?.people;
  const withheld = isWithheld(collection, people);
  const sources: Photo["sources"] = { avif: [], webp: [] };
  let derivativeBytes = 0;
  let servedBytes = 0;

  if (!withheld && storage) {
    const widths = WIDTHS.filter((w) => w <= width);
    if (widths.length === 0) widths.push(Math.min(width, MAX_WIDTH) as (typeof WIDTHS)[number]);
    for (const w of widths) {
      const resized = image.clone().resize({ width: w, withoutEnlargement: true });
      const [avif, webp] = await Promise.all([
        resized.clone().avif({ quality: 55, effort: 4 }).toBuffer(),
        resized.clone().webp({ quality: 78 }).toBuffer(),
      ]);
      const base = `photos/${collection.slug}/${id}-${hash}-${w}`;
      sources.avif.push({ width: w, url: await storage.put(`${base}.avif`, avif, "image/avif") });
      sources.webp.push({ width: w, url: await storage.put(`${base}.webp`, webp, "image/webp") });
      derivativeBytes += avif.length + webp.length;
      servedBytes = avif.length; // widths ascend, so this ends on the largest AVIF
    }
  }

  return {
    id,
    collection: collection.slug,
    file,
    hash,
    width,
    height,
    alt: previous?.alt ?? "",
    caption: previous?.caption,
    ...locate(collection, gps, previous?.stop),
    exif,
    thumbhash: withheld ? "" : await thumbhashOf(image),
    color: withheld ? "#1a1816" : await dominantColor(image),
    sources,
    bytes: { original: buf.length, derivatives: derivativeBytes, served: servedBytes },
    people,
    withheld: withheld || undefined,
  };
}

export async function ingest({ contentDir, storage, log = () => {} }: IngestOptions) {
  const collections = await loadCollections(contentDir);
  const previous = await loadManifest(contentDir);
  const prevById = new Map(previous?.photos.map((p) => [p.id, p]));
  const storageKind = storage?.kind ?? "none";

  const summary: IngestSummary = {
    added: [],
    updated: [],
    unchanged: [],
    removed: [],
    withheld: [],
    missingLocation: [],
    missingAlt: [],
  };
  const photos: Photo[] = [];

  for (const collection of collections) {
    const dir = path.join(contentDir, "collections", collection.slug, "photos");
    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter((f) => PHOTO_EXT.test(f)).sort();
    } catch {
      continue;
    }

    for (const file of files) {
      const buf = await readFile(path.join(dir, file));
      const hash = createHash("sha1").update(buf).digest("hex").slice(0, 12);
      const id = photoId(collection.slug, file);
      const prev = prevById.get(id);

      // Skip the expensive work when nothing changed: same bytes, same storage,
      // and the people gate hasn't flipped since last run.
      const stillWithheld = isWithheld(collection, prev?.people);
      const reusable =
        prev && prev.hash === hash && previous?.storage === storageKind && Boolean(prev.withheld) === stillWithheld;

      let photo: Photo;
      if (reusable) {
        photo = prev;
        summary.unchanged.push(id);
      } else {
        log(`  processing ${collection.slug}/${file}`);
        photo = await processPhoto(collection, file, buf, hash, prev, storage);
        (prev ? summary.updated : summary.added).push(id);
      }

      if (photo.withheld) summary.withheld.push(id);
      if (!photo.coords && !collection.locationPending && collection.kind === "place") {
        summary.missingLocation.push(id);
      }
      if (!photo.alt.trim()) summary.missingAlt.push(id);
      photos.push(photo);
    }
  }

  const kept = new Set(photos.map((p) => p.id));
  for (const p of previous?.photos ?? []) if (!kept.has(p.id)) summary.removed.push(p.id);

  const manifest: Manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    storage: photos.some((p) => p.sources.webp.length) ? storageKind : (previous?.storage ?? "none"),
    photos,
    stats: {
      photos: photos.length,
      derivatives: photos.reduce((n, p) => n + p.sources.avif.length + p.sources.webp.length, 0),
      bytesOriginal: photos.reduce((n, p) => n + p.bytes.original, 0),
      bytesDerivatives: photos.reduce((n, p) => n + p.bytes.derivatives, 0),
      bytesSaved: photos.reduce((n, p) => n + (p.bytes.served ? p.bytes.original - p.bytes.served : 0), 0),
    },
  };
  if (photos.length === 0) manifest.storage = "none";

  await writeFile(path.join(contentDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return { manifest, summary };
}
