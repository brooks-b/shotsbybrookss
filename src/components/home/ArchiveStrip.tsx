"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Frame } from "@/lib/frames";
import { pad } from "@/lib/format";
import { FrameImage } from "../FrameImage";
import { usePrefersReducedMotion } from "../motion/useReducedMotion";

/** A contact-sheet strip that drifts sideways as you scroll past it. */
export function ArchiveStrip({ frames, total }: { frames: Frame[]; total: number }) {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  const strip = useRef<HTMLDivElement>(null);

  // Drift with scroll, only while the strip is on screen and only on frames
  // where the page actually moved.
  useEffect(() => {
    const el = root.current;
    const s = strip.current;
    if (reduced || !el || !s) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = Math.min(Math.max((window.innerHeight - r.top) / (window.innerHeight + r.height), 0), 1);
      s.style.transform = `translateX(${(-22 * p).toFixed(3)}%)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
      } else {
        window.removeEventListener("scroll", onScroll);
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [reduced]);

  return (
    <section ref={root} aria-labelledby="archive-title" className="overflow-hidden py-24">
      <div className="gutter mb-10 flex items-baseline justify-between gap-6">
        <h2 id="archive-title" className="micro text-paper-dim">
          Archive [{total}]
        </h2>
        <Link href="/archive" className="micro text-paper-dim transition-colors hover:text-paper">
          View all →
        </Link>
      </div>

      <Link href="/archive" aria-label="Open the archive" className="block">
        <div ref={strip} className="w-max bg-ink-3 will-change-transform">
          <div className="sprockets" />
          <ul className="flex gap-1 px-1">
            {frames.map((f, i) => (
              <li key={f.key} className="w-[clamp(110px,13vw,200px)]">
                <div className="relative aspect-[4/5] overflow-hidden">
                  <FrameImage frame={f} sizes="200px" bare />
                </div>
                <p className="hud px-0.5 py-1 text-[10px] text-paper-faint">{pad(i + 1, 2)}A</p>
              </li>
            ))}
          </ul>
          <div className="sprockets" />
        </div>
      </Link>
    </section>
  );
}
