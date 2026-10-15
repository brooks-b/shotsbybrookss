import type { FilmSim } from "../types";

/**
 * Fujifilm maker-note parser.
 *
 * Fuji bodies write a self-contained IFD inside EXIF tag 0x927C:
 *
 *   "FUJIFILM"            8-byte signature
 *   uint32 LE             offset of the IFD, from the start of the note
 *   IFD (always LE)       count, then 12-byte entries, offsets relative to the note
 *
 * Because offsets are relative to the note itself, we can parse it without
 * knowing where it sat in the file. We only read the two tags that encode the
 * film simulation:
 *
 *   0x1401 FilmMode    colour sims (Provia, Velvia, Classic Chrome, …)
 *   0x1003 Saturation  doubles as the monochrome sim (Acros, B&W, Sepia)
 */

const SIGNATURE = "FUJIFILM";
const TAG_SATURATION = 0x1003;
const TAG_FILM_MODE = 0x1401;

const TYPE_SHORT = 3;

const FILM_MODES: Record<number, FilmSim> = {
  0x000: "Provia",
  0x100: "Provia", // F1 Studio Portrait, the Provia family
  0x110: "Provia",
  0x120: "Astia",
  0x130: "Provia",
  0x200: "Velvia",
  0x300: "Astia",
  0x400: "Velvia",
  0x500: "Pro Neg. Std",
  0x501: "Pro Neg. Hi",
  0x600: "Classic Chrome",
  0x700: "Eterna",
  0x800: "Classic Neg.",
  0x900: "Eterna Bleach Bypass",
  0xa00: "Nostalgic Neg.",
  0xb00: "Reala Ace",
};

/** Saturation values that mean "this is a monochrome simulation". */
function monochromeFromSaturation(value: number): FilmSim | null {
  if (value >= 0x500 && value <= 0x503) return "Acros";
  if (value === 0x310) return "Sepia";
  if (value >= 0x300 && value <= 0x303) return "Monochrome";
  return null;
}

/** Reads the uint16 tags we care about from a Fuji maker note. */
export function readFujiTags(note: Uint8Array): Map<number, number> {
  const tags = new Map<number, number>();
  if (note.length < 12) return tags;
  const signature = String.fromCharCode(...note.subarray(0, 8));
  if (signature !== SIGNATURE) return tags;

  const view = new DataView(note.buffer, note.byteOffset, note.byteLength);
  const ifd = view.getUint32(8, true);
  if (ifd + 2 > note.length) return tags;

  const count = view.getUint16(ifd, true);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > note.length) break;
    const tag = view.getUint16(entry, true);
    const type = view.getUint16(entry + 2, true);
    const n = view.getUint32(entry + 4, true);
    // Film sim tags are a single SHORT, stored inline in the value field.
    if (type === TYPE_SHORT && n === 1) {
      tags.set(tag, view.getUint16(entry + 8, true));
    }
  }
  return tags;
}

/** Returns the film simulation recorded in a Fuji maker note, or null if unknown. */
export function parseFilmSim(note: Uint8Array | undefined | null): FilmSim | null {
  if (!note) return null;
  const tags = readFujiTags(note);

  const saturation = tags.get(TAG_SATURATION);
  if (saturation !== undefined) {
    const mono = monochromeFromSaturation(saturation);
    if (mono) return mono;
  }

  const mode = tags.get(TAG_FILM_MODE);
  if (mode !== undefined) return FILM_MODES[mode] ?? null;

  // Colour shots with no FilmMode tag were taken on the default, Provia.
  return saturation !== undefined ? "Provia" : null;
}
