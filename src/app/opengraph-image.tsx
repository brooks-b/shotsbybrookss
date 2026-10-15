import { getAllFrames, getChapters, getHomeCover } from "@/lib/content";
import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Brooks Barrett, photography";

export default async function Image() {
  return ogCard({
    title: "Brooks Barrett",
    cover: getHomeCover(),
    lines: ["PHOTOGRAPHY  ·  FUJIFILM X-T50", `${getChapters().length} CHAPTERS  ·  [${getAllFrames().length}] FRAMES`],
  });
}
