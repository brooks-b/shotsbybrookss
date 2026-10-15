import type { Metadata } from "next";
import { Suspense } from "react";
import { ArchiveBrowser } from "@/components/archive/ArchiveBrowser";
import { getAllFrames, getChapters } from "@/lib/content";

export const metadata: Metadata = {
  title: "Archive",
  description: "Every frame, filterable by place, year, film simulation and focal length.",
  alternates: { canonical: "/archive" },
};

export default function ArchivePage() {
  const frames = getAllFrames();
  const places = getChapters()
    .filter((c) => c.kind === "place")
    .reverse()
    .map((c) => ({ value: c.slug, label: c.title }));

  return (
    <div className="gutter pb-12 pt-[calc(var(--header-h)+48px)]">
      <h1 className="display mb-14 text-[clamp(52px,9vw,160px)]">Archive</h1>
      {/* useSearchParams needs a boundary for static rendering. */}
      <Suspense fallback={<p className="micro text-paper-faint">Loading</p>}>
        <ArchiveBrowser frames={frames} places={places} />
      </Suspense>
    </div>
  );
}
