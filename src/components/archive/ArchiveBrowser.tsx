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

/** A stable shuffle key, so the mosaic mixes places but never reshuffles between visits. */
const hash = (key: string) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
};

type Tile = { kind: "cover"; c: Collection; frame: Frame; count: number } | { kind: "photo"; frame: Frame };

const VIEWS = [
  { value: "mosaic", label: "Mosaic" },
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
 * in three views: Mosaic (every photo in one field, each place's cover set
 * large and leading into its chapter), Grid, and Contact sheet. Filters and the
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
  const view = VIEWS.find((v) => v.value === params.get("view"))?.value ?? "mosaic";

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

  // Mosaic: every shown photo in one field, places mixed together. Each
  // place's cover is set in large, spread evenly through the field, and
  // leads into its chapter; everything else opens in the viewer.
  const tiles = useMemo(() => {
    const covers: Tile[] = [];
    const leads = new Set<Frame>();
    for (const c of collections) {
      const photos = shown.filter((f) => f.collection === c.slug && f.kind === "photo");
      const lead = photos.find((f) => f.key === c.cover.key) ?? photos[0];
      if (!lead) continue;
      leads.add(lead);
      covers.push({ kind: "cover", c, frame: lead, count: photos.length });
    }
    const rest: Tile[] = shown
      .filter((f) => f.kind === "photo" && !leads.has(f))
      .sort((a, b) => hash(a.key) - hash(b.key))
      .map((frame) => ({ kind: "photo", frame }));
    // Covers go in back to front so earlier insertions don't shift later slots.
    for (let i = covers.length - 1; i >= 0; i--) {
      rest.splice(Math.round((i * rest.length) / covers.length) + (i % 2) * 2, 0, covers[i]);
    }
    return rest;
  }, [collections, shown]);

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
                onClick={() => set("view", v.value === "mosaic" ? "" : v.value)}
                className="text-paper-faint transition-colors hover:text-paper aria-pressed:text-paper"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {shown.length === 0 && <p className="text-paper-dim">Nothing matches those filters.</p>}

      {view === "mosaic" ? (
        // Rows are a sixth (a third on phones) of the width, so every tile is square
        // and the large ones are exactly four small ones; dense flow fills the gaps.
        <div className="[container-type:inline-size]">
          <ul className="grid grid-flow-dense auto-rows-[calc((100cqw-16px)/3)] grid-cols-3 gap-2 md:auto-rows-[calc((100cqw-60px)/6)] md:grid-cols-6 md:gap-3">
            {tiles.map((t, i) =>
              t.kind === "cover" ? (
                <li key={`cover-${t.c.slug}`} className="col-span-2 row-span-2">
                  <Link href={`/chapters/${t.c.slug}`} className="group relative block h-full overflow-hidden">
                    <span className="absolute inset-0 block transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.03]">
                      <FrameImage frame={t.frame} sizes="(min-width: 768px) 33vw, 66vw" bare />
                    </span>
                    <span className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                      <span className="micro block text-paper/85 [text-shadow:0_1px_8px_rgb(0_0_0/0.5)]">
                        {t.c.year} · {t.count} {t.count === 1 ? "photo" : "photos"}
                      </span>
                      <span className="display mt-1 block text-[clamp(26px,3vw,52px)] [text-shadow:0_2px_24px_rgb(0_0_0/0.35)]">
                        {t.c.title}
                      </span>
                      <span className="micro mt-2 inline-block border-b border-paper/60 pb-0.5 text-paper">
                        Open collection →
                      </span>
                    </span>
                  </Link>
                </li>
              ) : (
                <li
                  key={t.frame.key}
                  // Every other portrait stands two rows tall, to break up the squares (not near the end, so it finishes flat).
                  className={
                    t.frame.height > t.frame.width && i % 2 === 0 && i < tiles.length - 12 ? "row-span-2" : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => setOpen(shown.indexOf(t.frame))}
                    className="group relative block h-full w-full overflow-hidden"
                    aria-label={`Open ${t.frame.alt}`}
                  >
                    <span className="absolute inset-0 block transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.04]">
                      <FrameImage frame={t.frame} sizes="(min-width: 768px) 16vw, 33vw" bare />
                    </span>
                  </button>
                </li>
              ),
            )}
          </ul>
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
