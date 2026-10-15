/**
 * Ambient tone: the page's near-black surfaces lean toward the colour of the
 * photo in view. The tint is a small mix of the photo's dominant colour into
 * the base ink, then darkened as needed so label text keeps AA contrast.
 */

type RGB = [number, number, number];

export const BASE = {
  ink: "#0e0d0b",
  ink2: "#151411",
  ink3: "#1d1b18",
};

/** The faintest text colour used on these surfaces (--paper-faint). */
const FAINT: RGB = [0x8a, 0x84, 0x7a];

const hexToRgb = (hex: string): RGB => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (c: RGB) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function luminance([r, g, b]: RGB) {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: RGB, b: RGB) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Photo colours are mostly dark, and dark-into-dark barely shows, so the tone
 * is brought up to full brightness first: only its hue and saturation count.
 */
function normalize(c: RGB): RGB {
  const max = Math.max(...c);
  return max === 0 ? c : (c.map((v) => (v * 200) / max) as RGB);
}

/** Mixes `amount` of `tone`'s hue into `base`, then darkens until faint text stays ≥ 4.6:1. */
export function tint(base: string, tone: string, amount: number): string {
  const b = hexToRgb(base);
  const t = normalize(hexToRgb(tone));
  let mixed = b.map((v, i) => v + (t[i] - v) * amount) as RGB;
  for (let k = 0; k < 24 && contrast(FAINT, mixed) < 4.6; k++) {
    mixed = mixed.map((v) => v * 0.9) as RGB;
  }
  return rgbToHex(mixed);
}

export function ambientFor(tone: string) {
  return {
    "--ink": tint(BASE.ink, tone, 0.13),
    "--ink-2": tint(BASE.ink2, tone, 0.14),
    "--ink-3": tint(BASE.ink3, tone, 0.15),
  };
}
