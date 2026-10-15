"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ambientFor } from "@/lib/tone";

const VARS = ["--ink", "--ink-2", "--ink-3"] as const;

/**
 * Watches every `[data-tone]` photo and tints the page toward the one that
 * owns the screen: the open lightbox if there is one, otherwise the photo
 * covering the most of the viewport's middle. With no photo in view the page
 * eases back to its neutral ink. The easing itself is a CSS transition on the
 * registered custom properties (see globals.css).
 */
export function AmbientTone() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    let current: string | null = null;

    const apply = (tone: string | null) => {
      if (tone === current) return;
      current = tone;
      if (!tone) {
        VARS.forEach((v) => root.style.removeProperty(v));
        return;
      }
      for (const [k, v] of Object.entries(ambientFor(tone))) root.style.setProperty(k, v);
    };

    const pick = (): string | null => {
      const dialogTone = document.querySelector<HTMLElement>("dialog[open] [data-tone]");
      if (dialogTone) return dialogTone.dataset.tone ?? null;

      const vh = window.innerHeight;
      const band = { top: vh * 0.2, bottom: vh * 0.8 };
      let best: { tone: string; score: number } | null = null;
      for (const el of document.querySelectorAll<HTMLElement>("[data-tone]")) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh || r.width === 0) continue;
        // Area inside the middle band of the screen, so a photo has to really
        // arrive before it takes over.
        const overlap = Math.max(0, Math.min(r.bottom, band.bottom) - Math.max(r.top, band.top));
        const score = overlap * Math.min(r.width, window.innerWidth);
        if (score > 0 && (!best || score > best.score)) best = { tone: el.dataset.tone!, score };
      }
      // Only tint when a photo fills a meaningful share of the band.
      const min = (band.bottom - band.top) * window.innerWidth * 0.12;
      return best && best.score > min ? best.tone : null;
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => apply(pick()));
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Hover previews and lightbox steps swap photos without scrolling.
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-tone", "open"],
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}
