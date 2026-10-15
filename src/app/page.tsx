import { GlobeSection } from "@/components/globe/GlobeSection";
import { ArchiveStrip } from "@/components/home/ArchiveStrip";
import { ChaptersIndex } from "@/components/home/ChaptersIndex";
import { KitTeaser } from "@/components/home/KitTeaser";
import { Preloader } from "@/components/home/Preloader";
import { SelectedWorks } from "@/components/home/SelectedWorks";
import { Statement } from "@/components/home/Statement";
import { getAllFrames, getChapters, getPhotoCovers, getSelectedWorks, getTravelStops } from "@/lib/content";

export default function Home() {
  const chapters = [...getChapters()].reverse();
  const all = getAllFrames();
  const edition = chapters.find((c) => c.kind === "edition");

  return (
    <>
      <Preloader />
      <GlobeSection stops={getTravelStops()} covers={getPhotoCovers()} />
      <Statement />
      <ChaptersIndex chapters={chapters} />
      <SelectedWorks frames={getSelectedWorks()} slug={edition?.slug ?? "top-10-2025"} />
      <ArchiveStrip frames={all.slice(0, 24)} total={all.length} />
      <KitTeaser />
    </>
  );
}
