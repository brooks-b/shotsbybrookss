"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { Frame } from "@/lib/frames";
import { formatFocal, pad } from "@/lib/format";
import { FrameImage } from "../FrameImage";
import { Lightbox } from "../Lightbox";

type Option = { value: string; label: string };
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
 * Every frame, filterable by place, year, film simulation and focal length.
 * Filters live in the URL (?place=japan&sim=classic-chrome&view=sheet), so
 * any view can be shared.
 */
export function ArchiveBrowser({ frames, places }: { frames: Frame[]; places: Option[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState<number | null>(null);

  const place = params.get("place") ?? "";
  const year = params.get("year") ?? "";
  const sim = params.get("sim") ?? "";
  const focal = params.get("focal") ?? "";
  const view = params.get("view") === "sheet" ? "sheet" : "grid";

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
            {(["grid", "sheet"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => set("view", v === "grid" ? "" : v)}
                className="text-paper-faint transition-colors hover:text-paper aria-pressed:text-paper"
              >
                {v === "grid" ? "Grid" : "Contact sheet"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {shown.length === 0 && <p className="text-paper-dim">Nothing matches those filters.</p>}

      {view === "grid" ? (
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
