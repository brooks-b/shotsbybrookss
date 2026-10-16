"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { Frame } from "@/lib/frames";
import { formatFocal, pad } from "@/lib/format";
import { FrameImage } from "../FrameImage";
import { Lightbox } from "../Lightbox";

type Option = { value: string; label: string };
type Collection = { slug: string; title: string; year: number; cover: Frame };

/** Small photos beside each big cover: a 3×3 block. */
const SMALLS = 9;
const VIEWS = [
  { value: "collections", label: "Collections" },
  { value: "grid", label: "Grid" },
  { value: "sheet", label: "Contact sheet" },
] as const;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function Select({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: Option[];
  onChange: (name: string, value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="micro text-paper-faint">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        disabled={options.length === 0}
        className="micro appearance-none border-b border-line bg-transparent py-1.5 pr-6 text-paper outline-none transition-colors hover:border-line-strong focus-visible:border-paper disabled:text-paper-faint"
        style={{
          backgroundImage:
            "linear-gradient(45deg, transparent 50%, #a8a196 50%), linear-gradient(135deg, #a8a196 50%, transparent 50%)",
          backgroundPosition: "calc(100% - 9px) 50%, calc(100% - 5px) 50%",
          backgroundSize: "4px 4px",
          backgroundRepeat: "no-repeat",
        }}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Every frame, filterable by place, year, film simulation and focal length,
 * in three views: Collections (each place's cover, big, leading into its
 * chapter, beside smaller photos), Grid, and Contact sheet. Filters and the
 * view live in the URL (?place=japan&sim=classic-chrome&view=grid), so any
 * view can be shared.
 */
export function ArchiveBrowser({
  frames,
  places,
  collections,
}: {
  frames: Frame[];
  places: Option[];
  collections: Collection[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState<number | null>(null);

  const place = params.get("place") ?? "";
  const year = params.get("year") ?? "";
  const sim = params.get("sim") ?? "";
  const focal = params.get("focal") ?? "";
  const view = VIEWS.find((v) => v.value === params.get("view"))?.value ?? "collections";

  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const years = useMemo(
    () => [...new Set(frames.map((f) => String(f.year)))].sort().map((y) => ({ value: y, label: y })),
    [frames],
  );
  const sims = useMemo(
    () =>
      [...new Set(frames.map((f) => f.exif?.filmSim).filter((s): s is NonNullable<typeof s> => Boolean(s)))]
        .sort()
        .map((s) => ({ value: slugify(s), label: s })),
    [frames],
  );
  const focals = useMemo(
    () =>
      [
        ...new Set(
          frames
            .map((f) => f.exif?.focalLength)
            .filter((n): n is number => Boolean(n))
            .map(Math.round),
        ),
      ]
        .sort((a, b) => a - b)
        .map((n) => ({ value: String(n), label: formatFocal(n)! })),
    [frames],
  );

  const shown = frames.filter(
    (f) =>
      (!place || f.collection === place) &&
      (!year || String(f.year) === year) &&
      (!sim || (f.exif?.filmSim && slugify(f.exif.filmSim) === sim)) &&
      (!focal || (f.exif?.focalLength && String(Math.round(f.exif.focalLength)) === focal)),
  );

  // Collections: the shown photos grouped by place, newest place first. The
  // big tile is the place's cover when the filters still include it.
  const groups = useMemo(
    () =>
      collections
        .map((c) => {
          const photos = shown.filter((f) => f.collection === c.slug && f.kind === "photo");
          const lead = photos.find((f) => f.key === c.cover.key) ?? photos[0];
          return { ...c, lead, rest: photos.filter((f) => f !== lead), total: photos.length };
        })
        .filter((g) => g.lead),
    [collections, shown],
  );

  const rolls = useMemo(() => {
    const map = new Map<string, Frame[]>();
    for (const f of shown) map.set(f.collectionTitle, [...(map.get(f.collectionTitle) ?? []), f]);
    return [...map.entries()];
  }, [shown]);

  return (
    <>
      <div className="mb-14 grid grid-cols-2 items-end gap-x-6 gap-y-6 md:grid-cols-6">
        <Select label="Place" name="place" value={place} options={places} onChange={set} />
        <Select label="Year" name="year" value={year} options={years} onChange={set} />
        <Select label="Film simulation" name="sim" value={sim} options={sims} onChange={set} />
        <Select label="Focal length" name="focal" value={focal} options={focals} onChange={set} />
        <div className="micro col-span-2 flex items-center justify-between gap-6 md:justify-end">
          <span className="text-paper-faint" aria-live="polite">
            [{shown.length}]
          </span>
          <div role="group" aria-label="View" className="flex gap-4">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                aria-pressed={view === v.value}
                onClick={() => set("view", v.value === "collections" ? "" : v.value)}
                className="text-paper-faint transition-colors hover:text-paper aria-pressed:text-paper"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {shown.length === 0 && <p className="text-paper-dim">Nothing matches those filters.</p>}

      {view === "collections" ? (
        <div className="flex flex-col gap-[clamp(64px,10vh,120px)]">
          {groups.map((g, gi) => {
            const smalls = g.rest.slice(0, g.rest.length > SMALLS ? SMALLS - 1 : SMALLS);
            const more = g.total - 1 - smalls.length;
            const right = gi % 2 === 1;
            return (
              <section
                key={g.slug}
                aria-label={g.title}
                className={`flex flex-col gap-2 md:items-start md:gap-3 ${right ? "md:flex-row-reverse" : "md:flex-row"}`}
              >
                {/* The big one: this place's cover, leading into its chapter. */}
                <Link
                  href={`/chapters/${g.slug}`}
                  className="group relative block aspect-[4/5] w-full overflow-hidden md:w-1/2"
                >
                  <span className="absolute inset-0 block transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.03]">
                    <FrameImage frame={g.lead} sizes="(min-width: 768px) 50vw, 100vw" bare />
                  </span>
                  <span className="absolute inset-x-0 bottom-0 p-5 md:p-7">
                    <span className="micro block text-paper/85 [text-shadow:0_1px_8px_rgb(0_0_0/0.5)]">
                      {g.year} · {g.total} {g.total === 1 ? "photo" : "photos"}
                    </span>
                    <span className="display mt-2 block text-[clamp(40px,5.4vw,96px)] [text-shadow:0_2px_24px_rgb(0_0_0/0.35)]">
                      {g.title}
                    </span>
                    <span className="micro mt-3 inline-block border-b border-paper/60 pb-0.5 text-paper">
                      Open collection →
                    </span>
                  </span>
                </Link>

                {/* The small ones open in the viewer. Nine of them stand exactly as tall as the big one. */}
                {smalls.length > 0 && (
                  <div
                    className={`grid w-full gap-2 md:w-1/2 md:gap-3 ${smalls.length <= 4 ? "grid-cols-2" : "grid-cols-3"}`}
                  >
                    {smalls.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setOpen(shown.indexOf(f))}
                        className="group relative block aspect-[4/5] overflow-hidden"
                        aria-label={`Open ${f.alt}`}
                      >
                        <span className="absolute inset-0 block transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.04]">
                          <FrameImage frame={f} sizes="(min-width: 768px) 16vw, 33vw" bare />
                        </span>
                      </button>
                    ))}
                    {more > 0 && (
                      <Link
                        href={`/chapters/${g.slug}`}
                        className="group flex aspect-[4/5] flex-col items-start justify-end bg-ink-2 p-3 transition-colors hover:bg-ink-3 md:p-4"
                      >
                        <span className="display text-[clamp(28px,2.6vw,44px)] text-paper-dim transition-colors group-hover:text-paper">
                          +{more}
                        </span>
                        <span className="micro mt-1 text-paper-faint">More in {g.title} →</span>
                      </Link>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((f, i) => (
            <li key={f.key}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="block w-full text-left"
                aria-label={`Open ${f.alt}`}
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <FrameImage frame={f} sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw" bare />
                </div>
                <p className="hud mt-2 flex justify-between gap-2 text-paper-faint">
                  <span className="truncate">{f.collectionTitle}</span>
                  <span>{pad(f.index, 2)}</span>
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-12">
          {rolls.map(([title, roll], r) => (
            <section key={title} aria-label={title}>
              <p className="micro mb-3 flex justify-between text-paper-faint">
                <span>
                  Roll {pad(r + 1, 2)} — {title}
                </span>
                <span>[{roll.length}]</span>
              </p>
              <div className="bg-ink-3">
                <div className="sprockets" />
                <ul className="grid grid-cols-3 gap-1 p-1 sm:grid-cols-6 lg:grid-cols-9">
                  {roll.map((f) => (
                    <li key={f.key}>
                      <button
                        type="button"
                        onClick={() => setOpen(shown.indexOf(f))}
                        className="block w-full"
                        aria-label={`Open ${f.alt}`}
                      >
                        <div className="relative aspect-[4/5] overflow-hidden">
                          <FrameImage frame={f} sizes="(min-width: 1024px) 11vw, 33vw" bare />
                        </div>
                        <p className="hud flex justify-between px-0.5 pt-1 text-[10px] text-paper-faint">
                          <span>{pad(f.index, 2)}A</span>
                          <span>{f.exif?.filmSim ? f.exif.filmSim.slice(0, 10) : ""}</span>
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="sprockets" />
              </div>
            </section>
          ))}
        </div>
      )}

      <Lightbox frames={shown} index={open} onIndex={setOpen} />
    </>
  );
}
