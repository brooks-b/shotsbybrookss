import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import exifr from "exifr";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeFixtureJpeg } from "../scripts/lib/fixture";
import { ingest } from "../scripts/lib/ingest-core";
import { localStorage } from "../scripts/lib/storage";
import { exifDateToIso, readExif } from "../src/lib/exif/read";
import { roundCoord } from "../src/lib/geo";
import type { Collection, Manifest } from "../src/lib/types";

let dir: string;

async function addCollection(c: Partial<Collection> & { slug: string }) {
  const full: Collection = {
    title: c.slug,
    kind: "place",
    stops: [{ name: "Tokyo", lat: 35.6762, lng: 139.6503, tz: "Asia/Tokyo" }],
    dates: { start: "2026-05", end: "2026-05" },
    order: 1,
    ...c,
  };
  await mkdir(path.join(dir, "content/collections", c.slug, "photos"), { recursive: true });
  await writeFile(path.join(dir, "content/collections", c.slug, "collection.json"), JSON.stringify(full));
}

const photoPath = (slug: string, file: string) => path.join(dir, "content/collections", slug, "photos", file);
const run = () => ingest({ contentDir: path.join(dir, "content"), storage: localStorage(path.join(dir, "public")) });

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "ingest-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("readExif", () => {
  it("parses X-T50 EXIF and the film simulation", async () => {
    const buf = await makeFixtureJpeg({ filmMode: 0x600, exposure: [1, 250], fNumber: [28, 10], iso: 200 });
    const { exif } = await readExif(buf);
    expect(exif).toMatchObject({
      make: "FUJIFILM",
      model: "X-T50",
      lens: "XF23mmF2 R WR",
      focalLength: 23,
      exposureTime: 0.004,
      fNumber: 2.8,
      iso: 200,
      takenAt: "2026-05-12T17:42:08",
      filmSim: "Classic Chrome",
    });
  });

  it("handles files with no EXIF", async () => {
    const sharp = (await import("sharp")).default;
    const plain = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } })
      .jpeg()
      .toBuffer();
    const { exif, gps } = await readExif(plain);
    expect(exif.filmSim).toBeNull();
    expect(gps).toBeUndefined();
  });

  it("converts EXIF dates", () => {
    expect(exifDateToIso("2025:12:24 09:05:00")).toBe("2025-12-24T09:05:00");
    expect(exifDateToIso("garbage")).toBeUndefined();
  });
});

describe("ingest", () => {
  it("drops a JPG in, gets a manifest entry with EXIF, film sim and derivatives", async () => {
    await addCollection({ slug: "japan" });
    await writeFile(photoPath("japan", "DSCF0001.jpg"), await makeFixtureJpeg({ filmMode: 0x800 }));

    const { manifest, summary } = await run();
    const [photo] = manifest.photos;
    expect(summary.added).toEqual(["japan-dscf0001"]);
    expect(photo.exif.filmSim).toBe("Classic Neg.");
    expect(photo.stop).toBe("Tokyo");
    expect(photo.width).toBe(1600);
    expect(photo.height).toBe(2000);
    expect(photo.thumbhash.length).toBeGreaterThan(10);
    expect(photo.sources.avif.map((s) => s.width)).toEqual([480, 960, 1440]);
    expect(photo.sources.webp).toHaveLength(3);
    expect(manifest.stats.bytesSaved).toBeGreaterThan(0);

    const written = JSON.parse(await readFile(path.join(dir, "content/manifest.json"), "utf8")) as Manifest;
    expect(written.photos[0].id).toBe("japan-dscf0001");
  });

  it("strips GPS from public files and rounds coordinates to city level", async () => {
    await addCollection({ slug: "japan" });
    await writeFile(
      photoPath("japan", "DSCF0002.jpg"),
      await makeFixtureJpeg({ gps: { lat: 35.658581, lng: 139.745433 } }),
    );

    const { manifest } = await run();
    const photo = manifest.photos[0];
    expect(photo.coords).toEqual({ lat: roundCoord(35.658581), lng: roundCoord(139.745433) });
    expect(photo.coords).toEqual({ lat: 35.7, lng: 139.7 });

    const files = await readdir(path.join(dir, "public/media/photos/japan"));
    expect(files.length).toBe(6);
    for (const f of files) {
      const meta = await exifr.parse(path.join(dir, "public/media/photos/japan", f), { gps: true }).catch(() => null);
      expect(meta?.latitude).toBeUndefined();
      expect(meta?.Make).toBeUndefined();
    }
  });

  it("never caps above 2560px and never upscales", async () => {
    await addCollection({ slug: "wide" });
    await writeFile(photoPath("wide", "BIG.jpg"), await makeFixtureJpeg({ width: 3200, height: 4000 }));
    const { manifest } = await run();
    const widths = manifest.photos[0].sources.webp.map((s) => s.width);
    expect(Math.max(...widths)).toBe(2560);
  });

  it("withholds people photos until cleared, and uploads nothing for them", async () => {
    await addCollection({ slug: "sports", people: { contains: true, cleared: false } });
    await writeFile(photoPath("sports", "DSCF0003.jpg"), await makeFixtureJpeg());

    const first = await run();
    expect(first.manifest.photos[0].withheld).toBe(true);
    expect(first.manifest.photos[0].sources.webp).toHaveLength(0);
    expect(first.summary.withheld).toEqual(["sports-dscf0003"]);

    await addCollection({ slug: "sports", people: { contains: true, cleared: true } });
    const second = await run();
    expect(second.manifest.photos[0].withheld).toBeUndefined();
    expect(second.manifest.photos[0].sources.webp.length).toBeGreaterThan(0);
    expect(second.summary.updated).toEqual(["sports-dscf0003"]);
  });

  it("skips unchanged photos and keeps hand-edited alt text", async () => {
    await addCollection({ slug: "japan" });
    await writeFile(photoPath("japan", "DSCF0004.jpg"), await makeFixtureJpeg());
    const first = await run();

    const manifestPath = path.join(dir, "content/manifest.json");
    first.manifest.photos[0].alt = "Torii gates in late light";
    await writeFile(manifestPath, JSON.stringify(first.manifest));

    const second = await run();
    expect(second.summary.unchanged).toEqual(["japan-dscf0004"]);
    expect(second.manifest.photos[0].alt).toBe("Torii gates in late light");
    expect(second.summary.missingAlt).toEqual([]);

    // Changing the file reprocesses it but keeps the alt text.
    await writeFile(photoPath("japan", "DSCF0004.jpg"), await makeFixtureJpeg({ colors: ["#335", "#111"] }));
    const third = await run();
    expect(third.summary.updated).toEqual(["japan-dscf0004"]);
    expect(third.manifest.photos[0].alt).toBe("Torii gates in late light");
  });

  it("reports photos it can't place and drops deleted ones", async () => {
    await addCollection({
      slug: "italy",
      stops: [
        { name: "Rome", lat: 41.9, lng: 12.5, tz: "Europe/Rome" },
        { name: "Amalfi", lat: 40.6, lng: 14.6, tz: "Europe/Rome" },
      ],
    });
    await writeFile(photoPath("italy", "A.jpg"), await makeFixtureJpeg());
    const first = await run();
    expect(first.summary.missingLocation).toEqual(["italy-a"]);

    await rm(photoPath("italy", "A.jpg"));
    const second = await run();
    expect(second.summary.removed).toEqual(["italy-a"]);
    expect(second.manifest.photos).toHaveLength(0);
  });
});
