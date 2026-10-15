// Shared content types. Used by the ingest script (Node) and the site (Next.js).

export type Region = "Asia" | "Europe" | "North America" | "Caribbean";

export type Stop = {
  name: string;
  lat: number;
  lng: number;
  /** IANA time zone, e.g. "Asia/Tokyo". */
  tz: string;
};

export type Collection = {
  slug: string;
  title: string;
  subtitle?: string;
  /** "place" chapters sit on the globe; "edition" chapters are curated sets. */
  kind: "place" | "edition";
  region?: Region;
  stops: Stop[];
  /** "YYYY-MM" strings. */
  dates: { start: string; end: string };
  /** True while dates are a best guess that Brooks still needs to confirm. */
  datesApprox?: boolean;
  /** True while the location is unknown; the chapter stays off the globe. */
  locationPending?: boolean;
  /** Original filename to use as the cover, e.g. "DSCF1234.jpg". */
  cover?: string;
  /** Travel order. Lower comes first. */
  order: number;
  /** One-line edition note shown under the chapter title. */
  note?: string;
  /** Photos of recognizable people stay withheld until `cleared` is true. */
  people?: { contains: boolean; cleared: boolean };
  /** Number of labeled placeholder frames to show until originals arrive. */
  placeholders?: number;
  /** For editions: photo ids (or "slug/placeholder-n") to feature, in order. */
  picks?: string[];
};

export const FILM_SIMS = [
  "Provia",
  "Velvia",
  "Astia",
  "Classic Chrome",
  "Pro Neg. Hi",
  "Pro Neg. Std",
  "Classic Neg.",
  "Nostalgic Neg.",
  "Reala Ace",
  "Eterna",
  "Eterna Bleach Bypass",
  "Acros",
  "Monochrome",
  "Sepia",
] as const;

export type FilmSim = (typeof FILM_SIMS)[number];

export type PhotoExif = {
  make?: string;
  model?: string;
  lens?: string;
  /** Millimetres, as recorded (not 35mm-equivalent). */
  focalLength?: number;
  /** Seconds, e.g. 0.004 for 1/250. */
  exposureTime?: number;
  fNumber?: number;
  iso?: number;
  /** ISO 8601 local time as the camera recorded it. */
  takenAt?: string;
  filmSim?: FilmSim | null;
};

export type ImageSource = { width: number; url: string };

export type Photo = {
  /** Stable id: `${collection}-${file stem}` lowercased. */
  id: string;
  collection: string;
  file: string;
  /** First 12 hex chars of the original's SHA-1. Used for cache-busting and skip-if-unchanged. */
  hash: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
  /** Name of the collection stop this photo belongs to. */
  stop?: string;
  /** City-level coordinates (rounded). Never full precision. */
  coords?: { lat: number; lng: number };
  exif: PhotoExif;
  /** Base64 thumbhash for the blur placeholder. */
  thumbhash: string;
  /** Dominant colour, "#rrggbb". */
  color: string;
  sources: { avif: ImageSource[]; webp: ImageSource[] };
  /** `served` is the largest AVIF: what a visitor downloads at most. */
  bytes: { original: number; derivatives: number; served: number };
  /** Set by Brooks per photo when it shows a recognizable person. */
  people?: boolean;
  /** True when the photo is held back pending people clearance. Nothing is uploaded. */
  withheld?: boolean;
};

export type Manifest = {
  version: 1;
  generatedAt: string;
  storage: "none" | "local" | "blob";
  photos: Photo[];
  stats: {
    photos: number;
    derivatives: number;
    bytesOriginal: number;
    bytesDerivatives: number;
    /** Sum of (original − largest AVIF) across published photos. */
    bytesSaved: number;
  };
};
