"use client";

import { gsap } from "gsap";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { TravelStop } from "@/lib/frames";
import { useMediaQuery, usePrefersReducedMotion } from "../motion/useReducedMotion";
import { visitPlace } from "../places/visit";
import { type GlobeDrive, newSpin, type Spin } from "./geo3d";

// Desktop gets the WebGL globe; phones get a 2D-canvas projection and never load three.js.
const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false });
const Globe2D = dynamic(() => import("./Globe2D"), { ssr: false });

/** Radians of turn per pixel dragged. */
const TURN = 0.0045;

/**
 * Drag to turn the globe; let go mid-swipe and it keeps spinning, then slows.
 * On touch only sideways drags turn it, so the page still scrolls.
 * Moves are tracked on the window rather than with pointer capture, so the
 * globe's own canvas still sees the press and release that make a pin click.
 */
function useHandSpin(el: React.RefObject<HTMLElement | null>, spin: React.RefObject<Spin>) {
  useEffect(() => {
    const host = el.current;
    if (!host) return;
    const s = spin.current;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let touch = false;
    const move = (e: PointerEvent) => {
      const dt = Math.max((e.timeStamp - lastT) / 1000, 1 / 120);
      const ax = (e.clientX - lastX) * TURN;
      const ay = touch ? 0 : (e.clientY - lastY) * TURN;
      s.moved += Math.hypot(e.clientX - lastX, e.clientY - lastY);
      s.dy += ax;
      s.dx += ay;
      // Smoothed, so the throw follows the last few moves rather than the very last one.
      s.vy += (Math.max(Math.min(ax / dt, 6), -6) - s.vy) * 0.4;
      s.vx += (Math.max(Math.min(ay / dt, 3), -3) - s.vx) * 0.4;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = e.timeStamp;
    };
    const up = (e: PointerEvent) => {
      // A pause before letting go means no throw.
      if (e.timeStamp - lastT > 80) s.vx = s.vy = 0;
      s.held = false;
      s.idle = 0;
      host.removeAttribute("data-held");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      touch = e.pointerType !== "mouse";
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = e.timeStamp;
      Object.assign(s, { held: true, moved: 0, vx: 0, vy: 0 });
      host.setAttribute("data-held", "");
      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    };
    host.addEventListener("pointerdown", down);
    return () => {
      host.removeEventListener("pointerdown", down);
      up(new PointerEvent("pointerup"));
    };
  }, [el, spin]);
}

/**
 * The route: every trip on one globe, arcs in travel order. It loads when it
 * gets close to the screen, fades in, draws the route once, and idles.
 * Clicking a pin opens that place, the same arrival as the board up top.
 * Drag to turn it by hand.
 */
export function GlobeSection({ stops }: { stops: TravelStop[] }) {
  const reduced = usePrefersReducedMotion();
  const lite = useMediaQuery("(max-width: 767px), (pointer: coarse)");
  const root = useRef<HTMLElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const drive = useRef<GlobeDrive>({ intro: 0, progress: 0, shift: 0, zoom: 0, from: 0 });
  const spinner = useRef<HTMLDivElement>(null);
  const spin = useRef<Spin>(newSpin());
  const [near, setNear] = useState(false);
  useHandSpin(spinner, spin);
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
    spin,
    // A drag that happens to end on a pin isn't a click.
    onPick: (i: number) => spin.current.moved < 6 && visitPlace(stops[i].slug),
  };

  return (
    <section
      ref={root}
      id="route"
      aria-labelledby="route-title"
      className="relative h-[100svh] min-h-[560px] overflow-hidden"
    >
      <div ref={spinner} className="absolute inset-0 cursor-grab touch-pan-y select-none data-[held]:cursor-grabbing">
        {near && (lite ? <Globe2D {...props} lite /> : <GlobeCanvas {...props} lite={false} />)}
        <div ref={label} aria-hidden className="hidden" />
      </div>
      <div className="gutter pointer-events-none relative flex h-full flex-col justify-end pb-[clamp(24px,5vh,56px)]">
        <p className="micro text-paper-faint">The route</p>
        <h2 id="route-title" className="display mt-3 text-[clamp(36px,5vw,80px)]">
          2024 — 2026
        </h2>
        <p className="mt-4 max-w-[34ch] text-paper-dim">
          {stops.length} cities, in the order they happened. Drag to turn it. Pick a pin to go there.
        </p>
      </div>
    </section>
  );
}
