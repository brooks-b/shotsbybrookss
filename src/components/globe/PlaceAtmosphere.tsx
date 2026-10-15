"use client";

import { useEffect, useRef } from "react";
import { ATMOSPHERES, type Atmosphere, type ParticleKind } from "./atmospheres";

type Particle = {
  kind: ParticleKind;
  layer: number;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Extra velocity from an entrance burst; decays to nothing. */
  ex: number;
  ey: number;
  size: number;
  rot: number;
  vr: number;
  phase: number;
  /** 0 = far (small, slow, faint), 1 = near (large, fast, soft-focused). */
  depth: number;
  /** Seconds left in the current state (droplets bead, shooting stars wait). */
  timer: number;
  fade: number;
  dying: boolean;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const DEPTH_KINDS = new Set<ParticleKind>(["petal", "leaf", "flake", "mote", "lantern", "bubble"]);

function spawn(kind: ParticleKind, layer: number, colors: string[], w: number, h: number, scatter: boolean): Particle {
  const depth = DEPTH_KINDS.has(kind) ? Math.random() ** 1.7 : 0.5;
  const k = 0.55 + depth * 1.1; // size and speed with depth
  const p: Particle = {
    kind,
    layer,
    color: pick(colors),
    x: rand(0, w),
    y: scatter ? rand(0, h) : -20,
    vx: 0,
    vy: 0,
    ex: 0,
    ey: 0,
    size: 1,
    rot: rand(0, Math.PI * 2),
    vr: rand(-1.2, 1.2),
    phase: rand(0, Math.PI * 2),
    depth,
    timer: 0,
    fade: 0,
    dying: false,
  };
  switch (kind) {
    case "petal":
      Object.assign(p, {
        x: rand(-0.1 * w, w),
        y: scatter ? p.y : rand(-80, -10),
        vx: rand(8, 34) * k,
        vy: rand(30, 60) * k,
        size: rand(4, 6.5) * k,
      });
      break;
    case "leaf":
      Object.assign(p, {
        x: rand(-0.05 * w, w),
        y: scatter ? p.y : rand(-80, -10),
        vx: rand(-14, 14) * k,
        vy: rand(22, 42) * k,
        size: rand(5, 8) * k,
        vr: rand(-0.8, 0.8),
      });
      break;
    case "streak":
      Object.assign(p, {
        x: rand(0, w * 1.15),
        y: scatter ? p.y : rand(-120, -10),
        vx: -70,
        vy: rand(680, 940),
        size: rand(12, 24),
      });
      break;
    case "droplet":
      Object.assign(p, {
        x: rand(0.03 * w, 0.97 * w),
        y: rand(0.05 * h, 0.8 * h),
        size: rand(3, 8),
        timer: rand(1.5, 5),
      });
      break;
    case "flake":
      Object.assign(p, {
        y: scatter ? p.y : rand(-60, -5),
        vx: rand(-8, 8) * k,
        vy: rand(16, 36) * k,
        size: rand(0.8, 2) * k,
      });
      break;
    case "lantern":
      Object.assign(p, {
        x: rand(0.04 * w, 0.96 * w),
        y: scatter ? p.y : h + rand(10, 80),
        vx: rand(-4, 4),
        vy: -rand(14, 26) * k,
        size: rand(2.6, 4.6) * k,
        rot: 0,
        vr: 0,
      });
      break;
    case "bubble":
      Object.assign(p, {
        y: scatter ? p.y : h + rand(10, 60),
        vx: rand(-4, 4),
        vy: -rand(18, 40) * k,
        size: rand(2, 5) * k,
        rot: 0,
        vr: 0,
      });
      break;
    case "mote":
      Object.assign(p, { y: rand(0, h), vx: rand(-6, 6), vy: rand(-5, 3), size: rand(0.7, 1.6) * k });
      break;
    case "firefly":
      Object.assign(p, { y: rand(h * 0.3, h), vx: rand(-10, 10), vy: rand(-8, 8), size: rand(1.3, 2) });
      break;
    case "star":
      Object.assign(p, { y: rand(0, h * 0.6), size: rand(0.5, 1.3) });
      break;
    case "shooting":
      Object.assign(p, {
        x: rand(0.1 * w, 0.7 * w),
        y: rand(0.02 * h, 0.3 * h),
        vx: rand(520, 760),
        vy: rand(160, 260),
        size: 1,
        timer: rand(1.5, 4),
      });
      break;
  }
  return p;
}

function drawShape(ctx: CanvasRenderingContext2D, p: Particle, t: number) {
  const a = p.fade * (0.55 + 0.45 * (1 - Math.abs(p.depth - 0.6)));
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  switch (p.kind) {
    case "petal": {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(t * 1.6 + p.phase)));
      ctx.globalAlpha = 0.85 * a;
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
      ctx.globalAlpha = 0.85 * a;
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.5);
      ctx.quadraticCurveTo(s * 0.85, 0, 0, s * 1.5);
      ctx.quadraticCurveTo(-s * 0.85, 0, 0, -s * 1.5);
      ctx.fill();
      ctx.globalAlpha = 0.3 * a;
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
      ctx.globalAlpha = 0.32 * p.fade;
      ctx.lineWidth = 1;
      const k = p.size / Math.hypot(p.vx, p.vy);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * k, p.y - p.vy * k);
      ctx.stroke();
      return;
    }
    case "droplet": {
      // A bead of water on the lens: a thin rim and a highlight.
      ctx.globalAlpha = 0.4 * p.fade;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * 0.85, p.size, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.75 * p.fade;
      ctx.beginPath();
      ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.4, Math.max(p.size * 0.18, 0.8), 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "flake":
    case "mote": {
      const tw = p.kind === "mote" ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.4 + p.phase)) : 0.85;
      ctx.globalAlpha = tw * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "lantern": {
      const flicker = 0.78 + 0.22 * Math.sin(t * 7 + p.phase * 3);
      ctx.globalAlpha = 0.95 * a * flicker;
      const w = p.size * 1.3;
      const h = p.size * 1.8;
      ctx.beginPath();
      ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, w * 0.35);
      ctx.fill();
      ctx.globalAlpha = 0.14 * a * flicker;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3.2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "bubble":
      ctx.globalAlpha = 0.55 * a;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case "firefly": {
      const blink = Math.max(0, Math.sin(t * 1.8 + p.phase * 2)) ** 3;
      ctx.globalAlpha = 0.14 * blink * p.fade;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.95 * blink * p.fade;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "star":
      ctx.globalAlpha = (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 2.2 + p.phase * 5))) * p.fade;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "shooting": {
      if (p.timer > 0) return;
      ctx.globalAlpha = 0.85 * p.fade;
      ctx.lineWidth = 1.2;
      const k = 120 / Math.hypot(p.vx, p.vy);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * k, p.y - p.vy * k);
      ctx.stroke();
      return;
    }
  }
}

/** How a place's weather arrives on the first frame. */
function enter(a: Atmosphere, w: number, h: number, scale: number): Particle[] {
  const out: Particle[] = [];
  a.layers.forEach((layer, li) => {
    const n = Math.round(layer.count * scale);
    const first = layer.kind === "star" ? n : Math.round(n * 0.75);
    for (let i = 0; i < first; i++) {
      const p = spawn(layer.kind, li, layer.colors, w, h, true);
      if (a.entrance === "burst" && layer.kind === "petal") {
        // Petals burst outward from the centre, then settle into falling.
        p.x = w / 2 + rand(-30, 30);
        p.y = h * 0.45 + rand(-30, 30);
        const ang = rand(0, Math.PI * 2);
        const sp = rand(160, 520) * (0.6 + p.depth);
        p.ex = Math.cos(ang) * sp;
        p.ey = Math.sin(ang) * sp - 60;
      } else if (a.entrance === "rise" && (layer.kind === "lantern" || layer.kind === "bubble")) {
        // Half are already aloft; the rest lift off from below, quickly at first.
        if (i % 2) {
          p.y = h + rand(0, h * 0.4);
          p.ey = -rand(120, 220);
        }
      } else if (!a.entrance && layer.kind !== "star") {
        continue;
      }
      out.push(p);
    }
  });
  return out;
}

/**
 * The weather for a place. One canvas; switching places lets the old particles
 * fade out while the new ones arrive. Pauses off screen and stays off under
 * reduced motion.
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
    const budget: number[] = [];
    let raf = 0;
    let last = performance.now();
    const scale = () => Math.min(Math.max(w / 1440, 0.45), 1);

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      const t = now / 1000;

      if (slugRef.current !== current) {
        current = slugRef.current;
        particles.forEach((p) => (p.dying = true));
        const a = current ? ATMOSPHERES[current] : undefined;
        if (a) particles.push(...enter(a, w, h, scale()));
        budget.length = 0;
      }

      const atmo = current ? ATMOSPHERES[current] : undefined;
      atmo?.layers.forEach((layer, li) => {
        const target = Math.max(1, Math.round(layer.count * scale()));
        const alive = particles.reduce((n, p) => n + (!p.dying && p.layer === li ? 1 : 0), 0);
        budget[li] = Math.min((budget[li] ?? 0) + dt * (target / 1.6), 2);
        while ((budget[li] ?? 0) >= 1 && alive < target) {
          particles.push(spawn(layer.kind, li, layer.colors, w, h, layer.kind === "star" || layer.kind === "mote"));
          budget[li] -= 1;
          break;
        }
      });

      ctx.clearRect(0, 0, w, h);
      const near: Particle[] = [];
      const keep: Particle[] = [];
      for (const p of particles) {
        p.fade = p.dying ? p.fade - dt / 0.8 : Math.min(1, p.fade + dt / 0.9);
        if (p.dying && p.fade <= 0) continue;

        const decay = Math.exp(-dt * 1.8);
        p.ex *= decay;
        p.ey *= decay;
        const sway = p.kind === "petal" || p.kind === "leaf" ? Math.sin(t * 1.3 + p.phase) * 18 * (0.6 + p.depth) : 0;
        if (p.kind === "mote" || p.kind === "firefly") {
          p.vx = (p.vx + rand(-12, 12) * dt) * 0.99;
          p.vy = (p.vy + rand(-12, 12) * dt) * 0.99;
        }
        if (p.kind === "droplet") {
          // Bead for a while, then slide down the lens, speeding up.
          p.timer -= dt;
          if (p.timer < 0) p.vy = Math.min(p.vy + 140 * dt, 220);
        }
        if (p.kind === "shooting") {
          p.timer -= dt;
          if (p.timer > 0) {
            keep.push(p);
            continue;
          }
        }
        p.x += (p.vx + p.ex + sway) * dt;
        p.y += (p.vy + p.ey) * dt;
        p.rot += p.vr * dt;

        const out = p.y > h + 60 || p.y < -140 || p.x < -80 || p.x > w + 80;
        if (out) {
          if (p.dying) continue;
          const layer = atmo?.layers[p.layer];
          if (!layer) continue;
          Object.assign(p, spawn(layer.kind, p.layer, layer.colors, w, h, false), {
            fade: p.kind === "mote" || p.kind === "firefly" || p.kind === "droplet" ? 0 : 1,
          });
        }
        if (p.depth > 0.82 && DEPTH_KINDS.has(p.kind)) near.push(p);
        else drawShape(ctx, p, t);
        keep.push(p);
      }
      // The nearest particles are drawn out of focus, like they're right at the lens.
      if (near.length) {
        ctx.filter = "blur(2.5px)";
        for (const p of near) drawShape(ctx, p, t);
        ctx.filter = "none";
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
