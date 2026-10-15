"use client";

import { useEffect, useRef } from "react";
import { ATMOSPHERES, type ParticleKind } from "./atmospheres";

type Particle = {
  kind: ParticleKind;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  phase: number;
  /** 0 → 1 fade-in, back to 0 when the place changes. */
  fade: number;
  dying: boolean;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Where a particle starts and how it moves, by kind. */
function spawn(kind: ParticleKind, colors: string[], w: number, h: number, scatter: boolean): Particle {
  const base = {
    kind,
    color: pick(colors),
    rot: rand(0, Math.PI * 2),
    vr: rand(-1.2, 1.2),
    phase: rand(0, Math.PI * 2),
    fade: 0,
    dying: false,
  };
  const anywhereY = rand(0, h);
  switch (kind) {
    case "petal":
      return {
        ...base,
        x: rand(-0.1 * w, w),
        y: scatter ? anywhereY : rand(-80, -10),
        vx: rand(8, 34),
        vy: rand(30, 62),
        size: rand(4, 7),
      };
    case "leaf":
      return {
        ...base,
        x: rand(-0.05 * w, w),
        y: scatter ? anywhereY : rand(-80, -10),
        vx: rand(-14, 14),
        vy: rand(22, 44),
        size: rand(5, 9),
        vr: rand(-0.8, 0.8),
      };
    case "streak":
      return {
        ...base,
        x: rand(0, w * 1.15),
        y: scatter ? anywhereY : rand(-120, -10),
        vx: -70,
        vy: rand(640, 900),
        size: rand(12, 22),
      };
    case "flake":
      return {
        ...base,
        x: rand(0, w),
        y: scatter ? anywhereY : rand(-60, -5),
        vx: rand(-8, 8),
        vy: rand(18, 42),
        size: rand(0.8, 2.4),
      };
    case "lantern":
      return {
        ...base,
        x: rand(0.05 * w, 0.95 * w),
        y: scatter ? anywhereY : h + rand(10, 80),
        vx: rand(-4, 4),
        vy: -rand(14, 30),
        size: rand(3, 5.5),
        rot: 0,
        vr: 0,
      };
    case "bubble":
      return {
        ...base,
        x: rand(0, w),
        y: scatter ? anywhereY : h + rand(10, 60),
        vx: rand(-4, 4),
        vy: -rand(18, 42),
        size: rand(2, 6),
        rot: 0,
        vr: 0,
      };
    case "mote":
      return { ...base, x: rand(0, w), y: anywhereY, vx: rand(-6, 6), vy: rand(-5, 3), size: rand(0.8, 1.8) };
    case "firefly":
      return { ...base, x: rand(0, w), y: rand(h * 0.25, h), vx: rand(-10, 10), vy: rand(-8, 8), size: rand(1.3, 2) };
    case "star":
      return { ...base, x: rand(0, w), y: rand(0, h * 0.75), vx: 0, vy: 0, size: rand(0.5, 1.4) };
  }
}

function draw(ctx: CanvasRenderingContext2D, p: Particle, t: number) {
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  const a = p.fade;
  switch (p.kind) {
    case "petal": {
      // A soft teardrop that flips as it tumbles.
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(t * 1.6 + p.phase)));
      ctx.globalAlpha = 0.8 * a;
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.95, -s * 0.15, 0, s);
      ctx.quadraticCurveTo(-s * 0.95, -s * 0.15, 0, -s);
      ctx.fill();
      ctx.restore();
      return;
    }
    case "leaf": {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(0.4 + 0.6 * Math.abs(Math.cos(t * 0.9 + p.phase)), 1);
      ctx.globalAlpha = 0.75 * a;
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.5);
      ctx.quadraticCurveTo(s * 0.85, 0, 0, s * 1.5);
      ctx.quadraticCurveTo(-s * 0.85, 0, 0, -s * 1.5);
      ctx.fill();
      ctx.globalAlpha = 0.35 * a;
      ctx.strokeStyle = "#0e0d0b";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.3);
      ctx.lineTo(0, s * 1.3);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case "streak": {
      ctx.globalAlpha = 0.3 * a;
      ctx.lineWidth = 1;
      const k = p.size / Math.hypot(p.vx, p.vy);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * k, p.y - p.vy * k);
      ctx.stroke();
      return;
    }
    case "flake":
      ctx.globalAlpha = 0.75 * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "lantern": {
      const flicker = 0.75 + 0.25 * Math.sin(t * 7 + p.phase * 3);
      ctx.globalAlpha = 0.9 * a * flicker;
      const w = p.size * 1.3;
      const h = p.size * 1.8;
      ctx.beginPath();
      ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, w * 0.35);
      ctx.fill();
      return;
    }
    case "bubble":
      ctx.globalAlpha = 0.5 * a;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case "mote":
      ctx.globalAlpha = (0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.4 + p.phase))) * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "firefly": {
      const blink = Math.max(0, Math.sin(t * 1.8 + p.phase * 2)) ** 3;
      ctx.globalAlpha = 0.12 * blink * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.95 * blink * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "star":
      ctx.globalAlpha = (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 2.2 + p.phase * 5))) * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      return;
  }
}

/**
 * The weather for the place you're visiting. One canvas over the globe;
 * switching places lets the old particles fade out while the new ones drift
 * in. Pauses off screen and stays off under reduced motion.
 */
export function PlaceAtmosphere({ slug, running }: { slug: string | null; running: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const slugRef = useRef(slug);
  useEffect(() => {
    slugRef.current = slug;
  }, [slug]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !running) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let particles: Particle[] = [];
    let current: string | null = null;
    let spawnBudget = 0;
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      const t = now / 1000;

      // Place changed: let the old weather fade out and start the new one.
      if (slugRef.current !== current) {
        current = slugRef.current;
        particles.forEach((p) => (p.dying = true));
        // A first handful are scattered across the screen so it doesn't start empty.
        const a = current ? ATMOSPHERES[current] : undefined;
        if (a && a.kind !== "star") {
          const n = Math.round(a.count * Math.min(Math.max(w / 1440, 0.45), 1) * 0.35);
          for (let i = 0; i < n; i++) particles.push(spawn(a.kind, a.colors, w, h, true));
        }
      }

      const atmo = current ? ATMOSPHERES[current] : undefined;
      if (atmo) {
        const target = Math.round(atmo.count * Math.min(Math.max(w / 1440, 0.45), 1));
        const alive = particles.reduce((n, p) => n + (p.dying ? 0 : 1), 0);
        spawnBudget += dt * (target / 1.4);
        while (spawnBudget >= 1 && alive + 1 <= target) {
          particles.push(spawn(atmo.kind, atmo.colors, w, h, atmo.kind === "star"));
          spawnBudget -= 1;
          if (particles.length > target * 2) break;
        }
        spawnBudget = Math.min(spawnBudget, 2);
      }

      ctx.clearRect(0, 0, w, h);
      const keep: Particle[] = [];
      for (const p of particles) {
        p.fade = p.dying ? p.fade - dt / 0.8 : Math.min(1, p.fade + dt / 0.9);
        if (p.fade <= 0 && p.dying) continue;

        // Gentle sway for anything that drifts.
        const sway = p.kind === "petal" || p.kind === "leaf" ? Math.sin(t * 1.3 + p.phase) * 18 : 0;
        if (p.kind === "mote" || p.kind === "firefly") {
          p.vx += rand(-12, 12) * dt;
          p.vy += rand(-12, 12) * dt;
          p.vx *= 0.99;
          p.vy *= 0.99;
        }
        p.x += (p.vx + sway) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        // Recycle anything that has left the screen.
        const out = p.y > h + 40 || p.y < -100 || p.x < -60 || p.x > w + 60;
        if (out) {
          if (p.dying) continue;
          Object.assign(p, spawn(p.kind, atmo?.colors ?? [p.color], w, h, false), { fade: 1 });
          if (p.kind === "mote" || p.kind === "firefly") p.fade = 0;
        }
        draw(ctx, p, t);
        keep.push(p);
      }
      particles = keep;
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [running]);

  return <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
