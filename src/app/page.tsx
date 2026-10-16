import { GlobeSection } from "@/components/globe/GlobeSection";
import { ArchiveStrip } from "@/components/home/ArchiveStrip";
import { KitTeaser } from "@/components/home/KitTeaser";
import { Preloader } from "@/components/home/Preloader";
import { SelectedWorks } from "@/components/home/SelectedWorks";
import { Arrival } from "@/components/places/Arrival";
import { Opening } from "@/components/places/Opening";
import { getAllFrames, getChapters, getMosaicFrames, getPlaces, getSelectedWorks, getTravelStops } from "@/lib/content";

export default function Home() {
  const chapters = [...getChapters()].reverse();
  const all = getAllFrames();
  const edition = chapters.find((c) => c.kind === "edition");
  const places = getPlaces();

  return (
    <>
      <Preloader />
      <Opening places={places} mosaic={getMosaicFrames()} />
      <GlobeSection stops={getTravelStops()} />
      <SelectedWorks frames={getSelectedWorks()} slug={edition?.slug ?? "top-10-2025"} />
      <ArchiveStrip frames={all.slice(0, 24)} total={all.length} />
      <KitTeaser />
      {/* Outside the pinned opening, so its fixed layer isn't trapped by the pin's transform. */}
      <Arrival places={places} />
    </>
  );
}
