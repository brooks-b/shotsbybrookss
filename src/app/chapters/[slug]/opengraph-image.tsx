import { getChapter, getChapters } from "@/lib/content";
import { formatLat, formatLng, formatRange } from "@/lib/format";
import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Chapter cover";

export function generateStaticParams() {
  return getChapters().map((c) => ({ slug: c.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getChapter(slug)!;
  const s = c.stops[0];
  return ogCard({
    title: c.title,
    cover: c.cover,
    lines: [
      ...(s ? [`${formatLat(s.lat)}  /  ${formatLng(s.lng)}`] : []),
      `${formatRange(c.dates)}  ·  [${c.frames}] FRAMES`,
    ],
  });
}
