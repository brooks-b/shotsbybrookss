import { describe, expect, it } from "vitest";
import { ambientFor, BASE, contrast, tint } from "../src/lib/tone";

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number];
};
const FAINT = rgb("#8a847a");
const PAPER = rgb("#ede8df");

describe("ambient tone", () => {
  it.each(["#ffffff", "#f0602f", "#3c8d2f", "#2b6cb0", "#c9a227", "#000000"])(
    "keeps label text readable for %s",
    (tone) => {
      for (const v of Object.values(ambientFor(tone))) {
        expect(contrast(FAINT, rgb(v))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(PAPER, rgb(v))).toBeGreaterThanOrEqual(12);
      }
    },
  );

  it("leans toward the photo but stays near-black", () => {
    const green = tint(BASE.ink, "#3c8d2f", 0.16);
    const [r, g, b] = rgb(green);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    expect(Math.max(r, g, b)).toBeLessThan(40);
  });
});
