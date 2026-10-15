"use client";

import { useEffect, useMemo, useState } from "react";

/** Small seeded RNG so the foliage looks the same on every render. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GREENS = ["#0d170b", "#13210f", "#1a2c14", "#223a18", "#0a1208"];

/** A dense cluster of leaf silhouettes, heaviest along one edge. */
function Cluster({ side, seed }: { side: "left" | "right"; seed: number }) {
  const leaves = useMemo(() => {
    const r = mulberry32(seed);
    return Array.from({ length: 120 }, () => {
      // Densest along the inner edge: that's the strip left framing the photo once the curtain parts.
      const edge = r() ** 1.4;
      // Some spill past the inner edge, so the curtain never shows a straight cut.
      const x = side === "left" ? 460 - edge * 460 : edge * 460 - 60;
      return {
        x,
        y: r() * 880 - 40,
        len: 50 + r() * 90,
        wid: 18 + r() * 26,
        rot: (side === "left" ? 40 : -40) + (r() - 0.5) * 140,
        fill: GREENS[Math.floor(r() * GREENS.length)],
      };
    });
  }, [side, seed]);
  return (
    <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" className="h-full w-full overflow-visible">
      {leaves.map((l, i) => (
        <path
          key={i}
          d={`M0,${-l.len} Q${l.wid},0 0,${l.len} Q${-l.wid},0 0,${-l.len} Z`}
          transform={`translate(${l.x} ${l.y}) rotate(${l.rot})`}
          fill={l.fill}
        />
      ))}
    </svg>
  );
}

/**
 * Rwanda's arrival: two curtains of jungle foliage cover the photo, then part
 * like you're stepping into a clearing. What's left frames the edges and sways.
 */
export function Foliage() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const curtain = "absolute inset-y-[-4%] w-[58%] transition-transform duration-[1800ms] ease-[var(--ease-shutter)]";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={`${curtain} left-0`} style={{ transform: open ? "translateX(-80%)" : "translateX(0)" }}>
        <div className="h-full w-full origin-left animate-[sway_7s_ease-in-out_infinite] motion-reduce:animate-none">
          <Cluster side="left" seed={7} />
        </div>
      </div>
      <div className={`${curtain} right-0`} style={{ transform: open ? "translateX(80%)" : "translateX(0)" }}>
        <div className="h-full w-full origin-right animate-[sway_8s_ease-in-out_infinite_reverse] motion-reduce:animate-none">
          <Cluster side="right" seed={13} />
        </div>
      </div>
    </div>
  );
}
