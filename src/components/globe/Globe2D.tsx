"use client";

import { useEffect, useRef } from "react";
import { GLOBE_READY } from "@/lib/preloader";
import { angleDelta, arcPoints, type GlobeProps, latLngToVec3, rotationToFace, type Vec3 } from "./geo3d";

const PAPER = "237,232,223";
const SIGNAL = "240,96,47";

type V = Vec3;

/**
 * The phone globe: same route, arcs and pins as the WebGL one, drawn on a 2D
 * canvas with an orthographic projection. No three.js renderer, no shader
 * compiles, so it stays smooth on mid-range phones.
 */
export default function Globe2D({ stops, active, focus, label, drive, running, onPick }: GlobeProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // The draw loop reads these through refs so it never restarts on a new stop.
  const activeRef = useRef(active);
  const focusRef = useRef(new Set(focus));
  const pickRef = useRef(onPick);
  useEffect(() => {
    activeRef.current = active;
    focusRef.current = new Set(focus);
    pickRef.current = onPick;
  });

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !running) return;

    let dots: Float32Array | null = null;
    let raf = 0;
    let w = 0;
    let h = 0;
    const rot = { x: 0.32, y: 0 };
    let zoomed = 0;
    const stopVecs: V[] = stops.map((s) => latLngToVec3(s.lat, s.lng));
    const arcs: V[][] = stops.slice(1).map((s, i) => arcPoints(stops[i], s, 40));
    let pins: { x: number; y: number; i: number }[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // Rotate (Y, then X, matching the WebGL globe's Euler XYZ) and project.
    const project = (v: V, R: number, cx: number, cy: number) => {
      const cb = Math.cos(rot.y);
      const sb = Math.sin(rot.y);
      const x1 = v.x * cb + v.z * sb;
      const z1 = -v.x * sb + v.z * cb;
      const ca = Math.cos(rot.x);
      const sa = Math.sin(rot.x);
      const y2 = v.y * ca - z1 * sa;
      const z2 = v.y * sa + z1 * ca;
      return { x: cx + x1 * R, y: cy - y2 * R, z: z2, r: Math.hypot(x1, y2) };
    };

    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      const d = drive.current;
      const stop = stops[activeRef.current];
      const ease = (rate: number) => 1 - Math.exp(-dt * rate);

      if (stop) {
        const t = rotationToFace(stop.lat, stop.lng);
        rot.x += (t.x * (0.85 + 0.15 * zoomed) - rot.x) * ease(3.2);
        rot.y += angleDelta(rot.y, t.y) * ease(3.2);
      } else {
        rot.x += (0.32 - rot.x) * ease(2);
        rot.y += dt * 0.06;
      }

      zoomed += (d.zoom - zoomed) * ease(2.5);
      // Capped so the zoomed globe stays inside its box on small screens.
      const R = Math.min(Math.min(w, h) * 0.44 * (0.94 + 0.06 * d.intro) * (1 + 0.35 * zoomed), Math.min(w, h) * 0.5);
      const cx = w / 2;
      const cy = h / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = d.intro;

      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = "#11100e";
      ctx.fill();

      if (dots) {
        const focus = stop ? stopVecs[activeRef.current] : null;
        for (let i = 0; i < dots.length; i += 3) {
          const v = { x: dots[i], y: dots[i + 1], z: dots[i + 2] };
          const p = project(v, R, cx, cy);
          if (p.z <= 0) continue;
          const near = focus && v.x * focus.x + v.y * focus.y + v.z * focus.z > 0.992;
          ctx.fillStyle = `rgba(${near ? SIGNAL : PAPER},${Math.min(p.z * 2.4, 1) * 0.85})`;
          ctx.fillRect(p.x - 0.8, p.y - 0.8, 1.6, 1.6);
        }
      }

      // Route: every leg is always visible; the travelled part draws brighter
      // and thicker with scroll progress.
      const legs = (f: (i: number) => number, style: string, width: number) => {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        arcs.forEach((points, i) => drawLeg(points, f(i)));
      };
      const drawLeg = (points: V[], f: number) => {
        if (f <= 0) return;
        const n = Math.max(1, Math.round(f * (points.length - 1)));
        ctx.beginPath();
        let pen = false;
        for (let k = 0; k <= n; k++) {
          const p = project(points[k], R, cx, cy);
          const shown = p.z > 0 || p.r > 1;
          if (shown && pen) ctx.lineTo(p.x, p.y);
          else if (shown) ctx.moveTo(p.x, p.y);
          pen = shown;
        }
        ctx.stroke();
      };
      legs(() => 1, `rgba(${SIGNAL},${stop ? 0.3 : 0.55})`, 1.25);
      if (stop) legs((i) => Math.min(Math.max(d.progress - i, 0), 1), `rgba(${SIGNAL},0.95)`, 2);

      pins = [];
      let tag: { x: number; y: number } | null = null;
      stopVecs.forEach((v, i) => {
        const p = project(v, R, cx, cy);
        if (p.z <= 0.05) return;
        pins.push({ x: p.x, y: p.y, i });
        const isActive = i === activeRef.current;
        if (isActive) tag = { x: p.x, y: p.y };
        // While touring, the current place's pins stay bright and the rest recede.
        const strength = stop ? (focusRef.current.has(i) ? 1 : 0.22) : 0.55;
        ctx.fillStyle = `rgba(${SIGNAL},${strength})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, isActive ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
        if (isActive) {
          const pulse = (now / 1600) % 1;
          ctx.strokeStyle = `rgba(${SIGNAL},${(1 - pulse) * 0.8})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4 + pulse * 14, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      ctx.globalAlpha = 1;

      // Pin the name tag beside the chosen city.
      const el = label.current;
      if (el) {
        const at = stop ? (tag as { x: number; y: number } | null) : null;
        if (at) el.style.transform = `translate(${Math.round(at.x + 12)}px, ${Math.round(at.y)}px) translateY(-50%)`;
        el.style.opacity = at ? "1" : "0";
      }
      raf = requestAnimationFrame(frame);
    };

    fetch("/globe/land-lite.bin")
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        const packed = new Int16Array(buf);
        const out = new Float32Array((packed.length / 2) * 3);
        for (let i = 0, j = 0; i < packed.length; i += 2, j += 3) {
          const lat = (packed[i] / 100) * (Math.PI / 180);
          const lng = (packed[i + 1] / 100 + 180) * (Math.PI / 180);
          const phi = Math.PI / 2 - lat;
          out[j] = -Math.sin(phi) * Math.cos(lng);
          out[j + 1] = Math.cos(phi);
          out[j + 2] = Math.sin(phi) * Math.sin(lng);
        }
        dots = out;
        window.dispatchEvent(new Event(GLOBE_READY));
      });
    raf = requestAnimationFrame(frame);

    // Taps: pick the nearest visible pin within a thumb's reach.
    const onUp = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const hit = pins.map((p) => ({ ...p, d: Math.hypot(p.x - x, p.y - y) })).sort((a, b) => a.d - b.d)[0];
      if (hit && hit.d < 22) pickRef.current(hit.i);
    };
    el.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerup", onUp);
    };
  }, [stops, drive, running, label]);

  return <canvas ref={canvas} className="h-full w-full" aria-hidden />;
}
