import exifr from "exifr";
import type { PhotoExif } from "../types";
import { parseFilmSim } from "./fuji";

type RawExif = {
  Make?: string;
  Model?: string;
  LensModel?: string;
  FocalLength?: number;
  ExposureTime?: number;
  FNumber?: number;
  ISO?: number;
  DateTimeOriginal?: string;
  latitude?: number;
  longitude?: number;
  makerNote?: Uint8Array;
};

export type ReadResult = {
  exif: PhotoExif;
  /** Full-precision GPS, if the file had any. Callers must round it before storing. */
  gps?: { lat: number; lng: number };
};

/** "2026:05:12 17:42:08" → "2026-05-12T17:42:08" (camera-local, no zone). */
export function exifDateToIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : undefined;
}

const clean = (s: string | undefined) => s?.replace(/\0/g, "").trim() || undefined;

export async function readExif(input: Buffer | Uint8Array): Promise<ReadResult> {
  let raw: RawExif = {};
  try {
    raw =
      ((await exifr.parse(input, {
        tiff: true,
        exif: true,
        gps: true,
        makerNote: true,
        ifd1: false,
        xmp: false,
        icc: false,
        iptc: false,
        translateValues: false,
        reviveValues: false,
      })) as RawExif | undefined) ?? {};
  } catch {
    raw = {};
  }

  const make = clean(raw.Make);
  const exif: PhotoExif = {
    make,
    model: clean(raw.Model),
    lens: clean(raw.LensModel),
    focalLength: raw.FocalLength,
    exposureTime: raw.ExposureTime,
    fNumber: raw.FNumber,
    iso: raw.ISO,
    takenAt: exifDateToIso(raw.DateTimeOriginal),
    filmSim: make?.toUpperCase().startsWith("FUJIFILM") ? parseFilmSim(raw.makerNote) : null,
  };

  const gps =
    typeof raw.latitude === "number" && typeof raw.longitude === "number"
      ? { lat: raw.latitude, lng: raw.longitude }
      : undefined;

  return { exif, gps };
}
