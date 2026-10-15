"use client";

import { useState } from "react";
import type { Frame } from "@/lib/frames";
import { pad } from "@/lib/format";
import { FrameImage } from "../FrameImage";
import { Hud } from "../Hud";
import { Lightbox } from "../Lightbox";
import { Reveal } from "../motion/Reveal";
import { useMediaQuery } from "../motion/useReducedMotion";

type Block = { kind: "full" | "pair" | "left" | "right"; frames: Frame[] };

/**
 * Paces a chapter: one big frame, a pair, then singles pushed left and
 * right, with plenty of air between. Repeats.
 */
function paginate(frames: Frame[]): Block[] {
  const order: Block["kind"][] = ["full", "pair", "left", "right"];
  const blocks: Block[] = [];
  let i = 0;
  let g = 0;
  while (i < frames.length) {
    const kind = order[g % order.length];
    if (kind === "pair" && i + 1 < frames.length) {
      blocks.push({ kind, frames: frames.slice(i, i + 2) });
      i += 2;
    } else {
      blocks.push({ kind: kind === "pair" ? "left" : kind, frames: [frames[i]] });
      i += 1;
    }
    g++;
  }
  return blocks;
}

function Tile({
  frame,
  sizes,
  onOpen,
  className = "",
}: {
  frame: Frame;
  sizes: string;
  onOpen: () => void;
  className?: string;
}) {
  const coarse = useMediaQuery("(pointer: coarse)");
  const [hudOn, setHudOn] = useState(false);
  const landscape = frame.width > frame.height;

  return (
    <figure className={className}>
      <button
        type="button"
        className="group relative block w-full cursor-zoom-in text-left"
        aria-label={`Open ${frame.alt}`}
        onClick={() => {
          // Touch: first tap shows the HUD, second opens the viewer.
          if (coarse && !hudOn) setHudOn(true);
          else onOpen();
        }}
      >
        <Reveal className="relative overflow-hidden" style={{ aspectRatio: `${frame.width} / ${frame.height}` }}>
          <div className="absolute inset-0">
            <FrameImage frame={frame} sizes={sizes} bare />
          </div>
        </Reveal>
        <div
          data-on={hudOn}
          className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 data-[on=true]:opacity-100"
        >
          <Hud frame={frame} compact={!landscape} topLeft={<span>{frame.stop ?? frame.collectionTitle}</span>} />
        </div>
      </button>
      <figcaption className="hud mt-3 flex justify-between gap-3 text-paper-faint">
        <span>{pad(frame.index, 2)}</span>
        <span>{frame.kind === "photo" ? [frame.stop, frame.exif?.filmSim].filter(Boolean).join(" · ") : ""}</span>
      </figcaption>
    </figure>
  );
}

export function Sequence({ frames, title }: { frames: Frame[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const blocks = paginate(frames);
  const indexOf = (f: Frame) => frames.indexOf(f);

  return (
    <section
      aria-label={`${title} frames`}
      className="gutter flex flex-col gap-[clamp(80px,16vh,200px)] py-[clamp(80px,14vh,160px)]"
    >
      {blocks.map((b, bi) => {
        if (b.kind === "full") {
          const f = b.frames[0];
          const landscape = f.width > f.height;
          return (
            <Tile
              key={bi}
              frame={f}
              onOpen={() => setOpen(indexOf(f))}
              sizes={landscape ? "100vw" : "(min-width: 768px) 70vw, 100vw"}
              className={landscape ? "-mx-[var(--gutter)]" : "mx-auto w-full md:w-[min(70vw,calc(88svh*0.8))]"}
            />
          );
        }
        if (b.kind === "pair") {
          return (
            <div key={bi} className="grid gap-x-6 gap-y-16 md:grid-cols-12">
              {b.frames.map((f, i) => (
                <Tile
                  key={f.key}
                  frame={f}
                  onOpen={() => setOpen(indexOf(f))}
                  sizes="(min-width: 768px) 42vw, 100vw"
                  className={i === 0 ? "md:col-span-5 md:col-start-1" : "md:col-span-5 md:col-start-8 md:mt-[18vh]"}
                />
              ))}
            </div>
          );
        }
        const f = b.frames[0];
        return (
          <div key={bi} className="grid md:grid-cols-12">
            <Tile
              frame={f}
              onOpen={() => setOpen(indexOf(f))}
              sizes="(min-width: 768px) 42vw, 100vw"
              className={b.kind === "left" ? "md:col-span-5 md:col-start-2" : "md:col-span-5 md:col-start-7"}
            />
          </div>
        );
      })}
      <Lightbox frames={frames} index={open} onIndex={setOpen} title={title} />
    </section>
  );
}
