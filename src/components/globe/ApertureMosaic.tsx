"use client";

import { useEffect, useState } from "react";
import type { Frame } from "@/lib/frames";
import { site } from "@/lib/site";
import { clock } from "@/lib/time";
import { FrameImage } from "../FrameImage";

/**
 * The opening contact sheet. A wall of photos in staggered columns, the name
 * over it, and an EVF focus point in the middle. Everything here is driven by
 * one CSS variable on the parent section, --open (0 → 1), written on scroll:
 *
 *  - a hard-edged circular mask opens from the focus point, revealing the globe
 *  - the wall pushes toward the viewer and the columns drift apart
 *  - a thin ring traces the aperture edge, with the f-number riding on it
 *
 * No React state changes during the scroll; the browser does the work.
 */

/** Full stops from closed down to wide open. */
export const F_STOPS = ["F16", "F11", "F8", "F5.6", "F4", "F2.8", "F2"];

function Columns({
  frames,
  columns,
  rows,
  className,
  deferred,
}: {
  frames: Frame[];
  columns: number;
  rows: number;
  className: string;
  deferred: boolean;
}) {
  // Enough rows to overfill the screen while columns drift; photos repeat if needed.
  const cols = Array.from({ length: columns }, (_, c) =>
    Array.from({ length: rows }, (_, r) => frames[(c + r * columns) % frames.length]),
  );
  return (
    <div className={`absolute inset-x-0 -top-[14vh] h-[128vh] gap-[3px] ${className}`}>
      {cols.map((col, c) => (
        <div
          key={c}
          className="flex min-w-0 flex-1 flex-col gap-[3px]"
          style={{
            // Staggered like strips on a contact sheet; on scroll alternate
            // columns drift up and down as the aperture opens.
            transform: `translateY(calc(${c % 2 ? "-9vh" : "0vh"} + var(--open, 0) * ${c % 2 ? -16 : 16}vh))`,
          }}
        >
          {col.map((f, r) => (
            <div key={`${f.key}-${r}`} className="relative aspect-[2/3] w-full shrink-0 overflow-hidden bg-ink-2">
              <FrameImage frame={f} sizes={`${Math.round(100 / columns)}vw`} bare deferred={deferred} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ApertureMosaic({
  frames,
  now,
  fstop,
}: {
  frames: Frame[];
  now: Date | null;
  /** The f-number label; its text is set on scroll by the parent. */
  fstop: React.RefObject<HTMLSpanElement | null>;
}) {
  // The wall paints instantly from each photo's blur placeholder; the photos
  // themselves load once the page has finished loading, so they never compete
  // with the name, the fonts or the globe.
  const [deferred, setDeferred] = useState(true);
  useEffect(() => {
    const go = () => {
      if ("requestIdleCallback" in window) requestIdleCallback(() => setDeferred(false), { timeout: 1500 });
      else setTimeout(() => setDeferred(false), 300);
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);

  return (
    <div data-aperture className="pointer-events-auto absolute inset-0 z-20">
      {/* Masked layer: the wall, the name and the details. */}
      <div
        className="absolute inset-0 overflow-hidden bg-ink"
        style={{
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, transparent var(--r), #000 calc(var(--r) + 1px))",
          maskImage: "radial-gradient(circle at 50% 50%, transparent var(--r), #000 calc(var(--r) + 1px))",
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 brightness-[0.68]"
          style={{ transform: "scale(calc(1 + var(--open, 0) * 0.35))" }}
        >
          <Columns frames={frames} columns={8} rows={6} className="hidden md:flex" deferred={deferred} />
          <Columns frames={frames} columns={4} rows={8} className="flex md:hidden" deferred={deferred} />
        </div>

        <div
          className="gutter absolute inset-x-0 bottom-0 pb-[clamp(24px,5vh,56px)]"
          style={{
            opacity: "calc(1 - var(--open, 0) * 3)",
            transform: "translateY(calc(var(--open, 0) * -40px))",
          }}
        >
          <h1 className="display text-[clamp(52px,9.4vw,168px)]">
            Brooks
            <br />
            Barrett
          </h1>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <p className="max-w-[34ch] text-paper/85">{site.description}</p>
            <p className="hud flex gap-6 text-paper/85" suppressHydrationWarning>
              {site.clocks.map((c) => (
                <span key={c.label}>
                  {c.label} <span className="text-paper">{now ? clock(c.tz, now) : "--:--"}</span>
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>

      {/* Unmasked: the focus point, the aperture ring and its f-number. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="hud-frame absolute left-1/2 top-1/2 h-[72px] w-[96px] -translate-x-1/2 -translate-y-1/2 [--b:12px]"
          style={{ opacity: "calc(1 - var(--open, 0) * 5)" }}
        />
        <div
          className="absolute left-1/2 top-1/2 rounded-full border border-paper/45"
          style={{
            width: "calc(var(--r) * 2)",
            height: "calc(var(--r) * 2)",
            transform: "translate(-50%, -50%)",
            opacity: "calc((1 - var(--open, 0)) * 3)",
          }}
        />
        <span
          ref={fstop}
          className="hud absolute text-paper"
          style={{
            left: "calc(50% + max(58px, var(--r) * 0.7071 + 10px))",
            top: "calc(50% - max(36px, var(--r) * 0.7071 + 18px))",
            opacity: "calc((1 - var(--open, 0)) * 3)",
          }}
        >
          {F_STOPS[0]}
        </span>
        <span
          className="micro absolute left-1/2 top-[calc(50%+52px)] -translate-x-1/2 text-paper/80"
          style={{ opacity: "calc(1 - var(--open, 0) * 5)" }}
        >
          Scroll
        </span>
      </div>
    </div>
  );
}
