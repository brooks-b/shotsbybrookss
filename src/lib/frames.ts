import type { PhotoExif, Region, Stop } from "./types";

/**
 * What the UI renders for one slot in a chapter. Serializable, so server
 * components can hand it to client components.
 *
 *  - "photo":       a published photo with derivatives
 *  - "placeholder": a labeled stand-in until Brooks drops the original in
 *  - "withheld":    a real photo held back until people in it are cleared
 */
export type Frame = {
  key: string;
  kind: "photo" | "placeholder" | "withheld";
  collection: string;
  collectionTitle: string;
  /** 1-based position within its chapter. */
  index: number;
  total: number;
  width: number;
  height: number;
  alt: string;
  color: string;
  /** Saturation-weighted colour for the ambient page tint. */
  tone?: string;
  /**
   * Base64 thumbhash (~30 bytes). Decoded to a blur image in the browser, so
   * the page HTML doesn't carry a data URL per photo.
   */
  thumbhash?: string;
  avif?: string;
  webp?: string;
  /** Largest WebP, used as the <img> fallback src. */
  src?: string;
  exif: PhotoExif | null;
  stop?: string;
  year: number;
};

export type ChapterSummary = {
  slug: string;
  title: string;
  subtitle?: string;
  kind: "place" | "edition";
  region?: Region;
  stops: Stop[];
  dates: { start: string; end: string };
  datesApprox: boolean;
  locationPending: boolean;
  note?: string;
  order: number;
  frames: number;
  years: number[];
  cover: Frame;
};

export type TravelStop = Stop & {
  slug: string;
  chapter: string;
  region?: Region;
  year: number;
  frames: number;
  /** Position in overall travel order. */
  seq: number;
};
