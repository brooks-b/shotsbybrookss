import type { PhotoExif } from "./types";

/** 0.004 → "1/250", 2 → "2\"" */
export function formatShutter(seconds?: number): string | null {
  if (!seconds) return null;
  if (seconds >= 1) return `${Number(seconds.toFixed(1))}"`;
  return `1/${Math.round(1 / seconds)}`;
}

export const formatAperture = (f?: number) => (f ? `F${Number(f.toFixed(1))}` : null);
export const formatIso = (iso?: number) => (iso ? `ISO ${iso}` : null);
export const formatFocal = (mm?: number) => (mm ? `${Math.round(mm)}mm` : null);

/** The X-T50 style bottom readout: "1/250  F2.8  ISO 200  CLASSIC CHROME  23mm". */
export function exifReadout(exif: PhotoExif | null | undefined): string[] {
  if (!exif) return [];
  return [
    formatShutter(exif.exposureTime),
    formatAperture(exif.fNumber),
    formatIso(exif.iso),
    exif.filmSim?.toUpperCase() ?? null,
    formatFocal(exif.focalLength),
  ].filter((v): v is string => Boolean(v));
}

/** 35.6762 → "35.6762° N" */
export function formatLat(lat: number, digits = 4) {
  return `${Math.abs(lat).toFixed(digits)}° ${lat >= 0 ? "N" : "S"}`;
}
export function formatLng(lng: number, digits = 4) {
  return `${Math.abs(lng).toFixed(digits)}° ${lng >= 0 ? "E" : "W"}`;
}

/** 7 → "007" */
export const pad = (n: number, width = 3) => String(n).padStart(width, "0");

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "2026-05" → "MAY 2026" */
export function formatMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** {start, end} → "MAY 2026" or "MAR – APR 2026" or "DEC 2025 – APR 2026" */
export function formatRange(dates: { start: string; end: string }) {
  if (dates.start === dates.end) return formatMonth(dates.start);
  const [sy] = dates.start.split("-");
  const [ey] = dates.end.split("-");
  if (sy === ey) return `${formatMonth(dates.start).split(" ")[0]} – ${formatMonth(dates.end)}`;
  return `${formatMonth(dates.start)} – ${formatMonth(dates.end)}`;
}

export function formatBytes(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} KB`;
  return `${n} B`;
}
