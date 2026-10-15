"use client";

import { useEffect, useRef } from "react";
import type { Stop } from "@/lib/types";

const D2R = Math.PI / 180;

/**
 * A 2D-canvas locator globe: an orthographic projection of the same land
 * dots as the main globe, turned to face this chapter. No WebGL, ~25 KB of data.
 */
export function MiniGlobe({ stops, others, size = 260 }: { stops: Stop[]; others: Stop[]; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || stops.length === 0) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.width = size * dpr;
    el.height = size * dpr;
    ctx.scale(dpr, dpr);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lat0 = stops.reduce((s, p) => s + p.lat, 0) / stops.length;
    const lng0 = stops.reduce((s, p) => s + p.lng, 0) / stops.length;
    const R = size / 2 - 8;
    const c = size / 2;
    let dots: Int16Array | null = null;
    let raf = 0;
    let visible = true;

    const project = (lat: number, lng: number, center: number) => {
      const phi = lat * D2R;
      const lam = (lng - center) * D2R;
      const phi0 = lat0 * 0.75 * D2R;
      const cosC = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lam);
      return {
        x: c + R * Math.cos(phi) * Math.sin(lam),
        y: c - R * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lam)),
        front: cosC,
      };
    };

    const draw = (t: number) => {
      const center = lng0 + (reduced ? 0 : Math.sin(t / 4000) * 14);
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(c, c, R, 0, Math.PI * 2);
      ctx.fillStyle = "#14130f";
      ctx.fill();
      ctx.strokeStyle = "rgba(237,232,223,0.14)";
      ctx.stroke();

      if (dots) {
        ctx.fillStyle = "rgba(237,232,223,0.5)";
        for (let i = 0; i < dots.length; i += 2) {
          const p = project(dots[i] / 100, dots[i + 1] / 100, center);
          if (p.front <= 0) continue;
          ctx.globalAlpha = Math.min(p.front * 2, 1);
          ctx.fillRect(p.x - 0.6, p.y - 0.6, 1.2, 1.2);
        }
        ctx.globalAlpha = 1;
      }
      for (const s of others) {
        const p = project(s.lat, s.lng, center);
        if (p.front <= 0) continue;
        ctx.fillStyle = "rgba(168,161,150,0.7)";
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
      for (const s of stops) {
        const p = project(s.lat, s.lng, center);
        if (p.front <= 0) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = "#f0602f";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7 + (reduced ? 0 : (t / 90) % 10), 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(240,96,47,0.45)";
        ctx.stroke();
      }
    };

    const loop = (t: number) => {
      draw(t);
      if (!reduced && visible) raf = requestAnimationFrame(loop);
    };

    fetch("/globe/land-lite.bin")
      .then((r) => r.arrayBuffer())
      .then((b) => {
        dots = new Int16Array(b);
        raf = requestAnimationFrame(loop);
      });

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(loop);
    });
    io.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [stops, others, size]);

  return <canvas ref={canvas} style={{ width: size, height: size }} aria-hidden />;
}
