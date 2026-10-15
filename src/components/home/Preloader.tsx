"use client";

import { useEffect, useRef, useState } from "react";
import { pad } from "@/lib/format";
import { GLOBE_READY, PRELOADER_KEY as KEY } from "@/lib/preloader";

/**
 * 000 → 100 while fonts and the globe load, then the cover lifts away.
 * Once per session.
 */
export function Preloader() {
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<"loading" | "lifting" | "done">("loading");
  const raf = useRef(0);

  useEffect(() => {
    if (document.documentElement.dataset.loaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- skip on repeat visits
      setPhase("done");
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minDuration = reduced ? 200 : 1400;
    const start = performance.now();
    let ready = false;

    const globe = new Promise<void>((resolve) => {
      window.addEventListener(GLOBE_READY, () => resolve(), { once: true });
      setTimeout(resolve, 2500);
    });
    Promise.all([document.fonts?.ready, globe]).then(() => (ready = true));

    document.documentElement.style.overflow = "hidden";
    const tick = (now: number) => {
      const t = Math.min((now - start) / minDuration, 1);
      const value = Math.min(Math.round((1 - Math.pow(1 - t, 2)) * 100), ready ? 100 : 94);
      setCount(value);
      if (value >= 100) {
        try {
          sessionStorage.setItem(KEY, "1");
        } catch {}
        setPhase("lifting");
        document.documentElement.style.overflow = "";
        setTimeout(() => setPhase("done"), reduced ? 0 : 1000);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      document.documentElement.style.overflow = "";
    };
  }, []);

  return (
    <>
      {phase !== "done" && (
        <div
          role="progressbar"
          aria-label="Loading"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={count}
          className="fixed inset-0 z-[90] bg-ink transition-[clip-path] duration-[900ms] ease-[var(--ease-shutter)] [html[data-loaded]_&]:hidden"
          style={{ clipPath: phase === "lifting" ? "inset(0 0 100% 0)" : "inset(0 0 0 0)" }}
        >
          <div
            className="gutter absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center gap-4 transition-opacity duration-300"
            style={{ opacity: phase === "lifting" ? 0 : 1 }}
          >
            <span className="micro shrink-0 text-paper-dim">Brooks Barrett</span>
            <span className="relative h-px flex-1 bg-line">
              <span className="absolute inset-y-0 left-0 bg-paper" style={{ width: `${count}%` }} />
            </span>
            <span className="hud w-[3ch] shrink-0 text-right text-paper">{pad(count)}</span>
          </div>
        </div>
      )}
    </>
  );
}
