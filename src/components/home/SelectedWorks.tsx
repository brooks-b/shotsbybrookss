import Link from "next/link";
import type { Frame } from "@/lib/frames";
import { pad } from "@/lib/format";
import { FrameImage } from "../FrameImage";
import { Reveal } from "../motion/Reveal";

/**
 * An asymmetric spread on a 12-column grid. Each slot has its own span,
 * offset and vertical nudge, so it reads as a layout, not a grid.
 */
const SLOTS = [
  "md:col-start-1 md:col-span-6",
  "md:col-start-8 md:col-span-4 md:mt-[24vh]",
  "md:col-start-3 md:col-span-4",
  "md:col-start-8 md:col-span-5 md:mt-[12vh]",
  "md:col-start-1 md:col-span-4 md:mt-[6vh]",
  "md:col-start-6 md:col-span-5 md:mt-[20vh]",
  "md:col-start-2 md:col-span-5",
  "md:col-start-9 md:col-span-4 md:mt-[16vh]",
  "md:col-start-4 md:col-span-4",
  "md:col-start-9 md:col-span-3 md:mt-[10vh]",
];

export function SelectedWorks({ frames, slug }: { frames: Frame[]; slug: string }) {
  return (
    <section aria-labelledby="selected-title" className="gutter py-24">
      <div className="mb-16 flex items-baseline justify-between gap-6">
        <h2 id="selected-title" className="micro text-paper-dim">
          Selected works [{frames.length}]
        </h2>
        <Link href={`/chapters/${slug}`} className="micro text-paper-dim transition-colors hover:text-paper">
          Top 10 of 2025 →
        </Link>
      </div>

      <ol className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-12 md:gap-x-6 md:gap-y-[8vh]">
        {frames.slice(0, SLOTS.length).map((f, i) => (
          <li key={f.key} className={`${i % 3 === 0 ? "col-span-2" : "col-span-1"} ${SLOTS[i]}`}>
            <Link href={`/chapters/${f.collection}`} className="group block">
              <Reveal className="relative overflow-hidden" style={{ aspectRatio: `${f.width} / ${f.height}` }}>
                <div className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.02]">
                  <FrameImage frame={f} sizes="(min-width: 768px) 45vw, 100vw" bare />
                </div>
              </Reveal>
              <p className="hud mt-3 flex justify-between gap-3 text-paper-faint">
                <span>{pad(i + 1, 2)}</span>
                <span className="truncate">{f.kind === "photo" ? f.collectionTitle : ""}</span>
              </p>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
