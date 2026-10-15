import { describe, expect, it } from "vitest";
import { parseFilmSim, readFujiTags } from "../src/lib/exif/fuji";
import { fujiMakerNote } from "../scripts/lib/fixture";

describe("Fuji maker note", () => {
  it("reads FilmMode and Saturation", () => {
    const tags = readFujiTags(fujiMakerNote({ filmMode: 0x600, saturation: 0 }));
    expect(tags.get(0x1401)).toBe(0x600);
    expect(tags.get(0x1003)).toBe(0);
  });

  it.each([
    [0x000, "Provia"],
    [0x200, "Velvia"],
    [0x120, "Astia"],
    [0x600, "Classic Chrome"],
    [0x800, "Classic Neg."],
    [0xa00, "Nostalgic Neg."],
    [0xb00, "Reala Ace"],
    [0x700, "Eterna"],
  ])("maps FilmMode 0x%s", (mode, sim) => {
    expect(parseFilmSim(fujiMakerNote({ filmMode: mode, saturation: 0 }))).toBe(sim);
  });

  it("reads monochrome sims from Saturation", () => {
    expect(parseFilmSim(fujiMakerNote({ saturation: 0x500 }))).toBe("Acros");
    expect(parseFilmSim(fujiMakerNote({ saturation: 0x502 }))).toBe("Acros");
    expect(parseFilmSim(fujiMakerNote({ saturation: 0x300 }))).toBe("Monochrome");
    expect(parseFilmSim(fujiMakerNote({ saturation: 0x310 }))).toBe("Sepia");
  });

  it("defaults to Provia when only Saturation is present", () => {
    expect(parseFilmSim(fujiMakerNote({ saturation: 0x80 }))).toBe("Provia");
  });

  it("returns null for non-Fuji or truncated notes", () => {
    expect(parseFilmSim(new TextEncoder().encode("Nikon\0\0\0\0\0\0\0\0\0"))).toBeNull();
    expect(parseFilmSim(new Uint8Array(4))).toBeNull();
    expect(parseFilmSim(undefined)).toBeNull();
  });
});
