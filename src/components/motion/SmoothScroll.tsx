"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./useReducedMotion";

const LenisContext = createContext<Lenis | null>(null);
export const useLenis = () => useContext(LenisContext);

/** Input that can start a scroll. The frame loop sleeps until one of these happens. */
const WAKE_EVENTS = ["wheel", "touchstart", "touchmove", "keydown", "pointerdown", "scroll"] as const;
/** Frames to keep running after the scroll settles, so it lands cleanly. */
const SETTLE_FRAMES = 8;

/**
 * Lenis smooth scroll, run on demand. The animation-frame loop only runs
 * while a scroll is easing; the rest of the time the page does no per-frame
 * work at all, which matters for battery. Off entirely under prefers-reduced-motion.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (reduced) return;
    const instance = new Lenis({ lerp: 0.1, wheelMultiplier: 1, anchors: true, autoRaf: false });

    let raf = 0;
    let settled = 0;
    const loop = (time: number) => {
      instance.raf(time);
      settled = instance.isScrolling ? 0 : settled + 1;
      raf = settled > SETTLE_FRAMES ? 0 : requestAnimationFrame(loop);
    };
    const wake = () => {
      settled = 0;
      if (raf) return;
      // Lenis eases by elapsed time; restart its clock so a long sleep isn't one giant step.
      (instance as unknown as { time: number }).time = performance.now();
      raf = requestAnimationFrame(loop);
    };
    WAKE_EVENTS.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    // Programmatic scrolls (route changes, anchors) wake it too.
    const scrollTo = instance.scrollTo.bind(instance);
    instance.scrollTo = ((...args: Parameters<Lenis["scrollTo"]>) => {
      wake();
      return scrollTo(...args);
    }) as Lenis["scrollTo"];

    // eslint-disable-next-line react-hooks/set-state-in-effect -- the instance only exists client-side
    setLenis(instance);
    return () => {
      cancelAnimationFrame(raf);
      WAKE_EVENTS.forEach((e) => window.removeEventListener(e, wake));
      instance.destroy();
      setLenis(null);
    };
  }, [reduced]);

  // New route: jump to the top (unless there's a hash to land on).
  useEffect(() => {
    if (!window.location.hash) lenis?.scrollTo(0, { immediate: true });
  }, [pathname, lenis]);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
