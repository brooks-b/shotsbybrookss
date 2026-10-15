"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, ViewTransition } from "react";
import type { ChapterSummary } from "@/lib/frames";
import { pad } from "@/lib/format";
import { Dial } from "../Dial";
import { FrameImage } from "../FrameImage";
import { Hud } from "../Hud";

/**
 * The chapter index. Hovering, focusing or turning the dial previews a
 * chapter's cover, which morphs into the chapter hero on navigation.
 */
export function ChaptersIndex({ chapters }: { chapters: ChapterSummary[] }) {
  const [active, setActive] = useState(0);
  const router = useRouter();
  const current = chapters[active];

  return (
    <section id="chapters" aria-labelledby="chapters-title" className="gutter scroll-mt-20 py-24">
      <h2 id="chapters-title" className="micro mb-12 text-paper-dim">
        Chapters [{chapters.length}]
      </h2>

      <div className="grid gap-12 md:grid-cols-12">
        <ol className="md:col-span-7 lg:col-span-8">
          {chapters.map((c, i) => (
            <li key={c.slug}>
              <Link
                href={`/chapters/${c.slug}`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                data-active={i === active}
                className="group flex items-baseline gap-4 border-t border-line py-3 md:gap-6"
              >
                <span className="hud w-6 shrink-0 text-paper-faint">{pad(i + 1, 2)}</span>
                <span className="display flex-1 text-[clamp(30px,4.4vw,68px)] text-paper-faint transition-colors duration-300 group-hover:text-paper group-data-[active=true]:text-paper">
                  {c.title}
                </span>
                <span className="hud shrink-0 text-paper-faint">
                  {c.dates.start.slice(0, 4)} <span className="ml-3">[{c.frames}]</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <div className="hidden md:col-span-5 md:block lg:col-span-4">
          <div className="sticky top-[calc(var(--header-h)+32px)]">
            <Link
              href={`/chapters/${current.slug}`}
              className="relative block aspect-[4/5] w-full overflow-hidden bg-ink-2"
              aria-label={`Open ${current.title}`}
              tabIndex={-1}
            >
              <ViewTransition name={`cover-${current.slug}`} share="morph" default="none">
                <div className="absolute inset-0">
                  <FrameImage frame={current.cover} sizes="34vw" bare />
                </div>
              </ViewTransition>
              <Hud frame={current.cover} compact topLeft={<span>{current.title}</span>} />
            </Link>
            <div className="mt-6 flex items-center justify-between">
              <div>
                <p className="text-paper">{current.title}</p>
                <p className="text-paper-dim">{current.subtitle}</p>
              </div>
              <Dial
                labels={chapters.map((_, i) => pad(i + 1, 2))}
                value={active}
                onChange={setActive}
                onActivate={(i) => router.push(`/chapters/${chapters[i].slug}`)}
                label="Chapter dial"
                valueText={(i) => `${chapters[i].title}. Press Enter to open.`}
                size={104}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
