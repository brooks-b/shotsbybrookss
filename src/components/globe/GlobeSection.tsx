"use client";

import { gsap } from "gsap";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { TravelStop } from "@/lib/frames";
import { useMediaQuery, usePrefersReducedMotion } from "../motion/useReducedMotion";
import { visitPlace } from "../places/visit";
import type { GlobeDrive } from "./geo3d";

// Desktop gets the WebGL globe; phones get a 2D-canvas projection and never load three.js.
const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false });
const Globe2D = dynamic(() => import("./Globe2D"), { ssr: false });

/**
 * The route: every trip on one globe, arcs in travel order. It loads when it
 * gets close to the screen, fades in, draws the route once, and idles.
 * Clicking a pin opens that place, the same arrival as the board up top.
 */
export function GlobeSection({ stops }: { stops: TravelStop[] }) {
  const reduced = usePrefersReducedMotion();
  const lite = useMediaQuery("(max-width: 767px), (pointer: coarse)");
  const root = useRef<HTMLElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const drive = useRef<GlobeDrive>({ intro: 0, progress: 0, shift: 0, zoom: 0, from: 0 });
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);

  // Load a screen early; render frames only while on screen.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const early = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "100% 0px" });
    const onScreen = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    early.observe(el);
    onScreen.observe(el);
    return () => {
      early.disconnect();
      onScreen.disconnect();
    };
  }, []);

  // Fade in and draw the whole route the first time it's seen.
  useEffect(() => {
    if (!visible) return;
    const d = drive.current;
    if (reduced) {
      Object.assign(d, { intro: 1, progress: stops.length - 1 });
      return;
    }
    const t = gsap.timeline();
    t.to(d, { intro: 1, duration: 1.2, ease: "power2.out" });
    t.to(d, { progress: stops.length - 1, duration: 3.2, ease: "power1.inOut" }, 0.3);
    return () => {
      t.kill();
    };
  }, [visible, reduced, stops.length]);

  const props = {
    stops,
    active: -1,
    focus: [],
    label,
    drive,
    running: visible,
    onPick: (i: number) => visitPlace(stops[i].slug),
  };

  return (
    <section
      ref={root}
      id="route"
      aria-labelledby="route-title"
      className="relative h-[100svh] min-h-[560px] overflow-hidden"
    >
      <div className="absolute inset-0">
        {near && (lite ? <Globe2D {...props} lite /> : <GlobeCanvas {...props} lite={false} />)}
        <div ref={label} aria-hidden className="hidden" />
      </div>
      <div className="gutter pointer-events-none relative flex h-full flex-col justify-end pb-[clamp(24px,5vh,56px)]">
        <p className="micro text-paper-faint">The route</p>
        <h2 id="route-title" className="display mt-3 text-[clamp(36px,5vw,80px)]">
          2024 — 2026
        </h2>
        <p className="mt-4 max-w-[34ch] text-paper-dim">
          {stops.length} cities, in the order they happened. Pick a pin to go there.
        </p>
      </div>
    </section>
  );
}
