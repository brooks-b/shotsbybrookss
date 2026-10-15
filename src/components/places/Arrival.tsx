"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PlaceInfo } from "@/lib/frames";
import { formatLat, formatLng } from "@/lib/format";
import { clock, tzLabel } from "@/lib/time";
import { MiniGlobe } from "../chapter/MiniGlobe";
import { FrameImage } from "../FrameImage";
import { ATMOSPHERES } from "../globe/atmospheres";
import { PlaceAtmosphere } from "../globe/PlaceAtmosphere";
import { useLenis } from "../motion/SmoothScroll";
import { usePrefersReducedMotion } from "../motion/useReducedMotion";
import { VISIT_EVENT, type VisitDetail } from "./visit";

const CLOSED = "inset(50% 50% 50% 50%)";

/**
 * Arriving somewhere. The clicked panel grows to fill the screen, the photo
 * pushes in slowly, and the place's weather plays over it. City cards swap
 * the backdrop; a small locator globe shows where you are.
 */
export function Arrival({ places }: { places: PlaceInfo[] }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [city, setCity] = useState(0);
  const [clip, setClip] = useState(CLOSED);
  const [now, setNow] = useState<Date | null>(null);
  const opener = useRef<Element | null>(null);
  const back = useRef<HTMLButtonElement>(null);
  const origin = useRef(CLOSED);
  const lenis = useLenis();
  const reduced = usePrefersReducedMotion();

  const place = places.find((p) => p.slug === slug);
  const atmo = slug ? ATMOSPHERES[slug] : undefined;
  const c = place?.cities[city];
  const backdrop = (city === 0 ? place?.backdrop : undefined) ?? c?.photo ?? place?.backdrop;
  // Stable inputs for the locator globe, so the ticking clock doesn't restart it.
  const others = useMemo(() => places.flatMap((p) => p.cities), [places]);
  const here = useMemo(() => {
    const at = places.find((p) => p.slug === slug)?.cities[city];
    return at ? [at] : [];
  }, [places, slug, city]);

  // Open on a visit event, growing out of whatever was clicked.
  useEffect(() => {
    const onVisit = (e: Event) => {
      const { slug: s, from } = (e as CustomEvent<VisitDetail>).detail;
      opener.current = document.activeElement;
      if (from) {
        const { innerWidth: w, innerHeight: h } = window;
        origin.current = `inset(${from.top}px ${w - from.left - from.width}px ${h - from.top - from.height}px ${from.left}px)`;
      } else {
        origin.current = CLOSED;
      }
      setClip(origin.current);
      setCity(0);
      setSlug(s);
      requestAnimationFrame(() => requestAnimationFrame(() => setClip("inset(0px 0px 0px 0px)")));
    };
    window.addEventListener(VISIT_EVENT, onVisit);
    return () => window.removeEventListener(VISIT_EVENT, onVisit);
  }, []);

  const close = () => {
    setClip(origin.current);
    window.setTimeout(
      () => {
        setSlug(null);
        (opener.current as HTMLElement | null)?.focus?.();
      },
      reduced ? 0 : 750,
    );
  };

  // While open: page scroll stops, Esc closes, the clock ticks, focus moves in.
  useEffect(() => {
    if (!slug) return;
    lenis?.stop();
    const html = document.documentElement;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts on open
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    back.current?.focus({ preventScroll: true });
    return () => {
      lenis?.start();
      html.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close is stable enough for a key handler
  }, [slug, lenis]);

  if (!place || !c) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={place.title}
      data-tone={atmo?.tone}
      className="fixed inset-0 z-[55] overflow-hidden bg-ink text-paper transition-[clip-path] duration-[850ms] ease-[var(--ease-shutter)] motion-reduce:transition-none"
      style={{ clipPath: clip }}
    >
      {/* Backdrop: the place, pushing in slowly. Crossfades when you pick a city. */}
      <div className="absolute inset-0 brightness-[0.62]">
        {backdrop ? (
          <div
            key={backdrop.key}
            className="absolute inset-0 animate-[fade-up_0.9s_var(--ease-out)] motion-reduce:animate-none"
          >
            <div className="absolute inset-0 animate-[push-in_9s_var(--ease-out)_both] motion-reduce:animate-none">
              <FrameImage frame={backdrop} sizes="100vw" priority />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0" style={{ background: atmo?.tone ?? "#151411", opacity: 0.35 }} />
        )}
      </div>

      <PlaceAtmosphere slug={slug} running />

      <div className="gutter relative z-10 flex h-full flex-col justify-between pb-[clamp(24px,5vh,56px)] pt-6">
        <div className="flex items-center justify-between">
          <button
            ref={back}
            type="button"
            onClick={close}
            className="micro text-paper/85 transition-colors hover:text-paper"
          >
            ← All places
          </button>
          <span className="micro text-paper/70">
            {place.year}
            {place.region ? ` · ${place.region}` : ""}
          </span>
        </div>

        <div className="flex items-end justify-between gap-8">
          <div
            key={place.slug}
            className="min-w-0 animate-[fade-up_0.8s_var(--ease-out)_0.25s_both] motion-reduce:animate-none"
          >
            <h2 className="display text-[clamp(56px,10vw,184px)]">{place.title}</h2>
            <p className="hud mt-4 text-paper/80" suppressHydrationWarning>
              <span className="text-paper">{c.name}</span>
              <span className="mx-2 text-paper/50">·</span>
              {formatLat(c.lat, 2)} {formatLng(c.lng, 2)}
              <span className="mx-2 text-paper/50">·</span>
              {now ? `${clock(c.tz, now)} ${tzLabel(c.tz, now).split(" ")[0]}` : "--:--"}
            </p>

            {place.cities.length > 1 && (
              <ul
                role="group"
                aria-label={`Cities in ${place.title}`}
                className="mt-6 flex max-w-full gap-2 overflow-x-auto pb-1 md:max-w-[min(620px,50vw)]"
              >
                {place.cities.map((s, i) => {
                  const on = i === city;
                  return (
                    <li key={s.name} className="w-[78px] shrink-0 md:w-[96px]">
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={`${s.name}, ${s.frames} frames`}
                        onClick={() => setCity(i)}
                        className="group block w-full text-left"
                      >
                        <span
                          className={`relative block aspect-[4/5] overflow-hidden bg-ink-2 outline outline-1 outline-offset-2 transition-[opacity,outline-color] duration-300 ${on ? "opacity-100 outline-paper" : "opacity-60 outline-transparent group-hover:opacity-90"}`}
                        >
                          {s.photo && <FrameImage frame={s.photo} sizes="96px" bare />}
                        </span>
                        <span
                          className={`micro mt-2 flex justify-between gap-1 ${on ? "text-paper" : "text-paper/70"}`}
                        >
                          <span className="truncate">{s.name}</span>
                          <span className="shrink-0">{s.frames}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <Link
              href={`/chapters/${place.slug}`}
              className="micro mt-6 inline-block border-b border-paper/40 pb-1 text-paper transition-colors hover:border-paper"
            >
              Open {place.title} · {place.frames} photos →
            </Link>
          </div>

          <div className="hidden shrink-0 opacity-90 md:block">
            <MiniGlobe stops={here} others={others} size={150} />
          </div>
        </div>
      </div>
    </div>
  );
}
