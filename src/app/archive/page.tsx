import type { Metadata } from "next";
import { Suspense } from "react";
import { ArchiveBrowser } from "@/components/archive/ArchiveBrowser";
import { getAllFrames, getChapters } from "@/lib/content";

export const metadata: Metadata = {
  title: "Archive",
  description: "Every collection and every frame, filterable by place, year, film simulation and focal length.",
  alternates: { canonical: "/archive" },
};

export default function ArchivePage() {
  const frames = getAllFrames();
  const chapters = getChapters()
    .filter((c) => c.kind === "place")
    .reverse();
  const places = chapters.map((c) => ({ value: c.slug, label: c.title }));
  // Newest first, for the Collections view: each place's cover leads into its chapter.
  const collections = chapters
    .filter((c) => c.cover.kind === "photo")
    .map((c) => ({ slug: c.slug, title: c.title, year: Number(c.dates.start.slice(0, 4)), cover: c.cover }));

  return (
    <div className="gutter pb-12 pt-[calc(var(--header-h)+48px)]">
      <h1 className="display mb-14 text-[clamp(52px,9vw,160px)]">Archive</h1>
      {/* useSearchParams needs a boundary for static rendering. */}
      <Suspense fallback={<p className="micro text-paper-faint">Loading</p>}>
        <ArchiveBrowser frames={frames} places={places} collections={collections} />
      </Suspense>
    </div>
  );
}
