import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { MiniGlobe } from "@/components/chapter/MiniGlobe";
import { Sequence } from "@/components/chapter/Sequence";
import { FrameImage } from "@/components/FrameImage";
import { Hud } from "@/components/Hud";
import { getChapter, getChapters, getFrames, getTravelStops } from "@/lib/content";
import { formatLat, formatLng, formatRange } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return getChapters().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/chapters/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = getChapter(slug);
  if (!c) return {};
  const description = [c.subtitle, c.note].filter(Boolean).join(". ");
  return {
    title: c.title,
    description: description || `${c.title}, photographed by Brooks Barrett.`,
    alternates: { canonical: `/chapters/${slug}` },
  };
}

export default async function ChapterPage({ params }: PageProps<"/chapters/[slug]">) {
  const { slug } = await params;
  const chapter = getChapter(slug);
  if (!chapter) notFound();

  const chapters = getChapters();
  const i = chapters.findIndex((c) => c.slug === slug);
  const next = chapters[(i - 1 + chapters.length) % chapters.length];
  const frames = getFrames(slug);
  const first = chapter.stops[0];
  const others = getTravelStops().filter((s) => s.slug !== slug);

  return (
    <article>
      {/* Cover */}
      <header className="gutter grid min-h-[100svh] gap-10 pb-12 pt-[calc(var(--header-h)+48px)] md:grid-cols-12 md:items-end">
        <div className="md:col-span-6 lg:col-span-7">
          <Link href="/#chapters" className="micro text-paper-faint transition-colors hover:text-paper">
            ← Chapters
          </Link>
          <h1 className="display mt-8 text-[clamp(52px,9vw,160px)]">{chapter.title}</h1>
          {chapter.note && <p className="mt-6 max-w-[40ch] text-paper-dim">{chapter.note}</p>}

          <dl className="hud mt-12 grid max-w-[520px] grid-cols-2 gap-x-6 gap-y-4 text-paper-dim sm:grid-cols-4">
            <div>
              <dt className="text-paper-faint">Dates</dt>
              <dd className="mt-1">{formatRange(chapter.dates)}</dd>
            </div>
            <div>
              <dt className="text-paper-faint">Frames</dt>
              <dd className="mt-1">[{chapter.frames}]</dd>
            </div>
            {first && (
              <div className="col-span-2">
                <dt className="text-paper-faint">Location</dt>
                <dd className="mt-1">
                  {formatLat(first.lat, 2)} / {formatLng(first.lng, 2)}
                </dd>
              </div>
            )}
          </dl>
          {chapter.stops.length > 1 && (
            <p className="hud mt-6 text-paper-faint">{chapter.stops.map((s) => s.name).join("  →  ")}</p>
          )}
        </div>

        <div className="md:col-span-6 lg:col-span-5">
          <ViewTransition name={`cover-${slug}`} share="morph" default="none">
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-ink-2">
              <FrameImage frame={chapter.cover} sizes="(min-width: 768px) 42vw, 100vw" priority bare />
              <Hud frame={chapter.cover} />
            </div>
          </ViewTransition>
        </div>
      </header>

      <Sequence frames={frames} title={chapter.title} />

      {/* Locator: ties the chapter back to the main globe */}
      {chapter.stops.length > 0 && (
        <section
          aria-label="Location"
          className="gutter grid items-center gap-10 border-t border-line py-20 md:grid-cols-12"
        >
          <div className="md:col-span-4">
            <MiniGlobe stops={chapter.stops} others={others} />
          </div>
          <div className="md:col-span-6 md:col-start-6">
            <ul className="hud flex flex-col text-paper-dim">
              {chapter.stops.map((s) => (
                <li key={s.name} className="flex justify-between gap-6 border-t border-line py-3">
                  <span className="text-paper">{s.name}</span>
                  <span>
                    {formatLat(s.lat, 2)} / {formatLng(s.lng, 2)}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/#globe" className="micro mt-6 inline-block text-paper-dim transition-colors hover:text-paper">
              See it on the globe →
            </Link>
          </div>
        </section>
      )}

      {/* Next chapter */}
      <Link href={`/chapters/${next.slug}`} className="group gutter block border-t border-line pb-10 pt-16">
        <p className="micro text-paper-faint">Next chapter</p>
        <p className="display mt-4 text-[clamp(44px,8vw,140px)] text-paper-faint transition-colors duration-300 group-hover:text-paper">
          {next.title} →
        </p>
      </Link>
    </article>
  );
}
