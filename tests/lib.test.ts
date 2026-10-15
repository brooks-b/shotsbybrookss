import { describe, expect, it } from "vitest";
import { angleDelta, latLngToVec3, rotationToFace } from "../src/components/globe/geo3d";
import { exifReadout, formatLat, formatLng, formatRange, formatShutter } from "../src/lib/format";
import { distanceKm, roundCoord } from "../src/lib/geo";
import { extract } from "../src/lib/snippets";
import { tzLabel, utcOffsetMinutes } from "../src/lib/time";
import { Euler, Vector3 } from "three";

describe("format", () => {
  it("formats the EVF readout", () => {
    expect(
      exifReadout({ exposureTime: 0.004, fNumber: 2.8, iso: 200, filmSim: "Classic Chrome", focalLength: 23 }),
    ).toEqual(["1/250", "F2.8", "ISO 200", "CLASSIC CHROME", "23mm"]);
    expect(formatShutter(2)).toBe('2"');
    expect(exifReadout(null)).toEqual([]);
  });

  it("formats coordinates and ranges", () => {
    expect(formatLat(35.6762)).toBe("35.6762° N");
    expect(formatLng(-74.209)).toBe("74.2090° W");
    expect(formatRange({ start: "2026-05", end: "2026-05" })).toBe("MAY 2026");
    expect(formatRange({ start: "2026-03", end: "2026-04" })).toBe("MAR – APR 2026");
    expect(formatRange({ start: "2025-12", end: "2026-04" })).toBe("DEC 2025 – APR 2026");
  });
});

describe("geo", () => {
  it("rounds to city level", () => {
    expect(roundCoord(40.82591)).toBe(40.8);
    expect(roundCoord(-74.2649)).toBe(-74.3);
  });
  it("measures distance", () => {
    expect(distanceKm({ lat: 51.5072, lng: -0.1276 }, { lat: 48.8566, lng: 2.3522 })).toBeCloseTo(344, -1);
  });
});

describe("globe math", () => {
  it.each([
    [35.6762, 139.6503],
    [51.5072, -0.1276],
    [-33.8688, 151.2093],
    [18.4861, -69.9312],
  ])("turns %s, %s to face the camera", (lat, lng) => {
    const r = rotationToFace(lat, lng);
    const v = latLngToVec3(lat, lng);
    const p = new Vector3(v.x, v.y, v.z).applyEuler(new Euler(r.x, r.y, 0, "XYZ"));
    expect(p.distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-9);
  });
  it("takes the short way round", () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
  });
});

describe("time", () => {
  it("labels zones with DST", () => {
    const summer = new Date("2026-07-01T12:00:00Z");
    const winter = new Date("2026-01-15T12:00:00Z");
    expect(tzLabel("Asia/Tokyo", summer)).toBe("JST (UTC+9)");
    expect(tzLabel("Europe/London", summer)).toBe("BST (UTC+1)");
    expect(tzLabel("Europe/London", winter)).toBe("GMT (UTC+0)");
    expect(tzLabel("America/Chicago", winter)).toBe("CST (UTC−6)");
    expect(utcOffsetMinutes("America/New_York", summer)).toBe(-240);
  });
});

describe("snippet extraction", () => {
  it("extracts a function with its doc comment", () => {
    const src =
      "const a = 1;\n/** Doc. */\nexport function f(x: number) {\n  if (x) { return 1; }\n  return 2;\n}\nconst b = 2;";
    expect(extract(src, "export function f")).toBe(
      "/** Doc. */\nexport function f(x: number) {\n  if (x) { return 1; }\n  return 2;\n}",
    );
  });
  it("extracts a glsl template", () => {
    const src = "export const s = /* glsl */ `\n  void main() { }\n`;\nexport const t = 1;";
    expect(extract(src, "export const s")).toBe("export const s = /* glsl */ `\n  void main() { }\n`;");
  });
});
