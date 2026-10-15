"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef } from "react";
import type { Frame } from "@/lib/frames";
import { pad } from "@/lib/format";
import { FrameImage } from "../FrameImage";
import { usePrefersReducedMotion } from "../motion/useReducedMotion";

gsap.registerPlugin(ScrollTrigger);

/** A contact-sheet strip that drifts sideways as you scroll past it. */
export function ArchiveStrip({ frames, total }: { frames: Frame[]; total: number }) {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      gsap.fromTo(
        "[data-strip]",
        { xPercent: 0 },
        {
          xPercent: -22,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: 0.6 },
        },
      );
    },
    { scope: root, dependencies: [reduced] },
  );

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
        <div data-strip className="w-max bg-ink-3 will-change-transform">
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
