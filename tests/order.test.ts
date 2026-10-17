import { describe, expect, it } from "vitest";
import { spreadOrder } from "../src/lib/content";
import type { Photo } from "../src/lib/types";

const shot = (file: string, takenAt: string, stop = "A") => ({ file, stop, exif: { takenAt } }) as unknown as Photo;

describe("spreadOrder", () => {
  it("keeps stops in visit order but splits up shots from the same scene", () => {
    const photos = [
      shot("a1", "2026-07-13T10:00:00"),
      shot("a2", "2026-07-13T10:01:00"),
      shot("a3", "2026-07-13T10:02:00"),
      shot("b1", "2026-07-13T11:00:00"),
      shot("c1", "2026-07-13T12:00:00"),
      shot("c2", "2026-07-13T12:03:00"),
      shot("z1", "2026-07-12T09:00:00", "Z"),
    ];
    expect(spreadOrder(photos).map((p) => p.file)).toEqual(["z1", "a1", "b1", "c1", "a2", "c2", "a3"]);
  });

  it("leaves photos alone when every shot is its own scene", () => {
    const photos = [shot("x", "2026-01-01T10:00:00"), shot("y", "2026-01-01T11:00:00")];
    expect(spreadOrder(photos).map((p) => p.file)).toEqual(["x", "y"]);
  });
});
