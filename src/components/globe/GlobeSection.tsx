"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Frame, TravelStop } from "@/lib/frames";
import { formatLat, formatLng } from "@/lib/format";
import { site } from "@/lib/site";
import { clock, tzLabel } from "@/lib/time";
import { FrameImage } from "../FrameImage";
import { useMediaQuery, usePrefersReducedMotion } from "../motion/useReducedMotion";
import { ApertureMosaic, F_STOPS } from "./ApertureMosaic";
import { ATMOSPHERES } from "./atmospheres";
import type { GlobeDrive } from "./geo3d";
import { PlaceAtmosphere } from "./PlaceAtmosphere";

gsap.registerPlugin(ScrollTrigger);

// Desktop gets the WebGL globe; phones get a 2D-canvas projection and never load three.js.
const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false });
const Globe2D = dynamic(() => import("./Globe2D"), { ssr: false });

/** Scroll spent opening the aperture from the contact sheet onto the globe. */
const OPEN_VH = 1.1;
/** A short hold on the open globe before the page scrolls on. */
const HOLD_VH = 0.3;

/** A chapter's run of stops: one destination. */
type Place = { slug: string; chapter: string; year: number; first: number; indices: number[] };

const smooth = (t: number) => t * t * (3 - 2 * t);

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts client-side
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * The opening. It starts on a contact sheet of photos; scrolling opens an
 * aperture from the focus point onto the globe and asks where you want to go.
 * Pick a place (from the board or its pins) and the globe flies there, the
 * place's weather drifts in, and its cities line up as photo cards.
 */
export function GlobeSection({
  stops,
  covers,
  mosaic,
}: {
  stops: TravelStop[];
  covers: Record<string, Frame>;
  mosaic: Frame[];
}) {
  const reduced = usePrefersReducedMotion();
  const lite = useMediaQuery("(max-width: 767px), (pointer: coarse)");
  /** The place you've chosen to visit. */
  const [selected, setSelected] = useState<string | null>(null);
  /** The place under the pointer on the board, previewed on the globe. */
  const [preview, setPreview] = useState<string | null>(null);
  /** The city picked in each place, by name. Defaults to the first. */
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState(false);
  const [visible, setVisible] = useState(true);
  // Wait until after hydration (when `lite` is known) and the browser is idle,
  // so the globe never competes with first paint.
  const [boot, setBoot] = useState(false);
  useEffect(() => {
    const go = () => setBoot(true);
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(go, { timeout: 1200 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(go, 200);
    return () => clearTimeout(id);
  }, []);
  const root = useRef<HTMLElement>(null);
  /** Name tag that the globe renderers pin to the chosen city each frame. */
  const label = useRef<HTMLDivElement>(null);
  const fstop = useRef<HTMLSpanElement>(null);
  const drive = useRef<GlobeDrive>({ intro: 0, progress: 0, shift: 0, zoom: 0, from: 0 });
  const now = useNow();

  const places = useMemo(() => {
    const out: Place[] = [];
    stops.forEach((s, i) => {
      const last = out.at(-1);
      if (last && last.slug === s.slug) last.indices.push(i);
      else out.push({ slug: s.slug, chapter: s.chapter, year: s.year, first: i, indices: [i] });
    });
    return out;
  }, [stops]);
  const years = useMemo(() => [...new Set(places.map((p) => p.year))], [places]);

  const showing = selected ?? preview;
  const place = places.find((p) => p.slug === showing);
  const active = place ? (place.indices.find((i) => stops[i].name === chosen[place.slug]) ?? place.first) : -1;
  const stop = active >= 0 ? stops[active] : undefined;
  const visiting = Boolean(selected && stop);
  const atmosphere = selected ? ATMOSPHERES[selected] : undefined;

  // The globe fades in as the aperture opens (instantly under reduced motion);
  // it stops rendering while the section is off screen.
  useEffect(() => {
    if (reduced) {
      drive.current.intro = 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no aperture to open
      setOpened(true);
    }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, [reduced]);

  // Slide aside for the board; zoom in when visiting a place with several cities.
  useEffect(() => {
    drive.current.shift = opened ? 1 : 0;
    drive.current.zoom = visiting && place && place.indices.length > 1 ? 1 : 0;
  }, [opened, visiting, place]);

  // Light only the way in: the leg from the previous place, then on to the chosen city.
  useEffect(() => {
    drive.current.from = visiting && place ? place.first : 0;
    gsap.to(drive.current, {
      progress: visiting ? active : 0,
      duration: reduced ? 0 : 1.1,
      ease: "power2.inOut",
      overwrite: true,
    });
  }, [visiting, active, reduced, place]);

  // Esc goes back to the board.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  useGSAP(
    () => {
      if (reduced) return;
      const el = root.current!;
      const aperture = el.querySelector<HTMLElement>("[data-aperture]");
      const setOpen = (open: number) => {
        el.style.setProperty("--open", open.toFixed(4));
        drive.current.intro = smooth(Math.min(open * 1.4, 1));
        if (fstop.current)
          fstop.current.textContent = F_STOPS[Math.min(Math.floor(open * F_STOPS.length), F_STOPS.length - 1)];
        // Once fully open, the contact sheet steps aside so the globe takes clicks.
        if (aperture) aperture.style.visibility = open >= 0.999 ? "hidden" : "visible";
        setOpened(open >= 0.98);
      };
      setOpen(0);

      const st = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: () => `+=${(OPEN_VH + HOLD_VH) * window.innerHeight}`,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => setOpen(Math.min((self.progress * (OPEN_VH + HOLD_VH)) / OPEN_VH, 1)),
      });
      return () => st.kill();
    },
    { scope: root, dependencies: [reduced], revertOnUpdate: true },
  );

  const visit = (slug: string, city?: number) => {
    setSelected(slug);
    setPreview(null);
    if (city !== undefined) setChosen((c) => ({ ...c, [slug]: stops[city].name }));
  };

  /** A pin on the globe: visit its place, at that city. */
  const onPick = (i: number) => visit(stops[i].slug, i);

  const globeProps = {
    stops,
    active,
    focus: place?.indices ?? [],
    label,
    drive,
    running: visible,
    onPick,
  };

  return (
    <section
      ref={root}
      id="globe"
      aria-label="Around the world"
      data-tone={atmosphere?.tone}
      className="relative h-[100svh] min-h-[600px] overflow-hidden bg-ink"
      style={{ "--open": reduced ? 1 : 0, "--r": "calc(var(--open) * 78vmax)" } as React.CSSProperties}
    >
      {!reduced && mosaic.length > 0 && <ApertureMosaic frames={mosaic} now={now} fstop={fstop} />}

      <div className="absolute inset-x-0 bottom-[38%] top-[calc(var(--header-h)+8px)] md:inset-0">
        {boot && (lite ? <Globe2D {...globeProps} lite /> : <GlobeCanvas {...globeProps} lite={false} />)}
        <div
          ref={label}
          aria-hidden
          className="micro pointer-events-none absolute left-0 top-0 z-10 flex items-center gap-2 whitespace-nowrap text-paper opacity-0 transition-opacity duration-300 will-change-transform"
        >
          <span className="h-px w-5 bg-paper/60" />
          {stop?.name}
        </div>
      </div>

      {/* The weather for the place you're visiting. */}
      <div className="pointer-events-none absolute inset-0 z-[5]">
        <PlaceAtmosphere slug={selected} running={visible && opened} />
      </div>

      <div
        className="gutter pointer-events-none relative z-10 flex h-full flex-col justify-end pb-[clamp(24px,5vh,56px)] pt-[var(--header-h)]"
        style={{ opacity: "clamp(0, (var(--open, 1) - 0.82) * 6, 1)" }}
      >
        {visiting && stop && place ? (
          <div
            key={place.slug}
            aria-live="polite"
            className="pointer-events-auto animate-[fade-up_0.5s_var(--ease-out)] motion-reduce:animate-none"
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="micro text-paper-dim transition-colors hover:text-paper"
            >
              ← All places
            </button>
            <p
              className={`display mt-4 ${stop.chapter.length > 14 ? "text-[clamp(30px,3.6vw,56px)]" : "text-[clamp(36px,5vw,80px)]"}`}
            >
              {stop.chapter}
            </p>
            <p className="hud mt-3 text-paper-dim" suppressHydrationWarning>
              <span className="text-paper">{stop.name}</span>
              <span className="mx-2 text-paper-faint">·</span>
              {formatLat(stop.lat, 2)} {formatLng(stop.lng, 2)}
              <span className="mx-2 text-paper-faint">·</span>
              {now ? `${clock(stop.tz, now)} ${tzLabel(stop.tz, now).split(" ")[0]}` : "--:--"}
              {atmosphere && (
                <>
                  <span className="mx-2 text-paper-faint">·</span>
                  {atmosphere.label}
                </>
              )}
            </p>

            {/* One card per city: its photo, name and frame count. Picking one turns the globe. */}
            <ul
              role="group"
              aria-label={`Cities in ${stop.chapter}`}
              className="mt-5 flex max-w-full gap-2 overflow-x-auto pb-1 md:max-w-[min(560px,38vw)]"
            >
              {place.indices.map((i) => {
                const s = stops[i];
                const photo = covers[`${s.slug}|${s.name}`];
                const on = i === active;
                return (
                  <li key={s.name} className="w-[84px] shrink-0 md:w-[100px]">
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`${s.name}, ${s.frames} frames`}
                      onClick={() => setChosen((c) => ({ ...c, [s.slug]: s.name }))}
                      className="group block w-full text-left"
                    >
                      <span
                        className={`relative block aspect-[4/5] overflow-hidden bg-ink-2 transition-opacity duration-300 ${on ? "opacity-100" : "opacity-45 group-hover:opacity-80"}`}
                      >
                        {photo && <FrameImage frame={photo} sizes="100px" bare />}
                      </span>
                      <span className={`mt-1.5 block h-px transition-colors ${on ? "bg-signal" : "bg-transparent"}`} />
                      <span
                        className={`micro mt-1.5 flex justify-between gap-1 ${on ? "text-paper" : "text-paper-faint group-hover:text-paper-dim"}`}
                      >
                        <span className="truncate">{s.name}</span>
                        <span className="shrink-0">{s.frames}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <Link
              href={`/chapters/${stop.slug}`}
              className="micro mt-4 inline-block text-paper-dim transition-colors hover:text-paper"
            >
              Open {stop.chapter} →
            </Link>
          </div>
        ) : (
          <div className="pointer-events-auto" onPointerLeave={() => setPreview(null)}>
            {reduced && (
              <h1 className="display mb-10 text-[clamp(52px,9.4vw,168px)]">
                Brooks
                <br />
                Barrett
              </h1>
            )}
            <p className="micro text-paper-faint">
              Around the world — {places.length} places, {stops.length} cities
            </p>
            <h2 className="display mt-3 text-[clamp(34px,4.6vw,76px)]">
              Where do you
              <br />
              want to go?
            </h2>

            {/* The departures board, one column per year. */}
            <div className="mt-7 flex gap-x-10 gap-y-6 overflow-x-auto pb-1 md:grid md:max-w-[min(600px,42vw)] md:grid-cols-3 md:overflow-visible">
              {years.map((y) => (
                <div key={y} className="shrink-0">
                  <p className="micro mb-2 border-b border-line pb-2 text-paper-faint">{y}</p>
                  <ul className="flex flex-col">
                    {places
                      .filter((p) => p.year === y)
                      .map((p) => (
                        <li key={p.slug}>
                          <button
                            type="button"
                            onClick={() => visit(p.slug)}
                            onPointerEnter={() => setPreview(p.slug)}
                            onFocus={() => setPreview(p.slug)}
                            onBlur={() => setPreview(null)}
                            className="group flex w-full items-baseline justify-between gap-4 py-1 text-left"
                          >
                            <span className="font-display text-[clamp(17px,1.5vw,22px)] font-medium uppercase tracking-[-0.02em] text-paper-dim transition-colors group-hover:text-paper group-focus-visible:text-paper">
                              {p.chapter}
                            </span>
                            <span className="micro shrink-0 text-paper-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                              Go →
                            </span>
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
            {reduced && <p className="mt-6 max-w-[34ch] text-paper-dim">{site.description}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
