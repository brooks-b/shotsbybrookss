"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Frame, TravelStop } from "@/lib/frames";
import { formatLat, formatLng, pad } from "@/lib/format";
import { site } from "@/lib/site";
import { clock, tzLabel } from "@/lib/time";
import type { Region } from "@/lib/types";
import { FrameImage } from "../FrameImage";
import { useMediaQuery, usePrefersReducedMotion } from "../motion/useReducedMotion";
import { ApertureMosaic, F_STOPS } from "./ApertureMosaic";
import type { GlobeDrive } from "./geo3d";

gsap.registerPlugin(ScrollTrigger);

// Desktop gets the WebGL globe; phones get a 2D-canvas projection and never load three.js.
const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false });
const Globe2D = dynamic(() => import("./Globe2D"), { ssr: false });

const YEARS = ["All", "2024", "2025", "2026"] as const;
const REGIONS: ("All" | Region)[] = ["All", "North America", "Caribbean", "Europe", "Africa", "Asia"];
/** Scroll distance per place, in viewport heights. */
const VH_PER_PLACE = 0.9;
/** Scroll spent opening the aperture from the contact sheet onto the globe. */
const OPEN_VH = 1.1;
/** A beat on the whole globe before the tour starts. */
const IDLE_VH = 0.35;
/** Share of each place's scroll where the globe holds still before moving on. */
const HOLD = 0.62;

/** A chapter's run of consecutive stops: one step of the tour. */
type Place = { slug: string; chapter: string; first: number; indices: number[] };

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

function Filter<T extends string>(props: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={props.label} className="micro flex flex-wrap justify-end gap-x-3 gap-y-1">
      {props.options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={props.value === o}
          onClick={() => props.onChange(o)}
          className="text-paper-faint transition-colors hover:text-paper aria-pressed:text-paper"
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/**
 * The opening. It starts on a contact sheet of photos; scrolling opens an
 * aperture from the focus point onto the globe, then walks the globe place by
 * place in travel order, holding on each one and drawing the route as it goes.
 * Each place shows a strip of its cities' photos. One pinned scroll drives it all.
 */
export function GlobeSection({
  stops: allStops,
  covers,
  mosaic,
}: {
  stops: TravelStop[];
  covers: Record<string, Frame>;
  mosaic: Frame[];
}) {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const lite = useMediaQuery("(max-width: 767px), (pointer: coarse)");
  const [year, setYear] = useState<(typeof YEARS)[number]>("All");
  const [region, setRegion] = useState<"All" | Region>("All");
  const [placeIdx, setPlaceIdx] = useState(-1);
  /** The city picked in each place, by name. Defaults to the first. */
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const chosenRef = useRef(chosen);
  useEffect(() => {
    chosenRef.current = chosen;
  }, [chosen]);
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
  const [listOpen, setListOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  /** Name tag that the globe renderers pin to the chosen city each frame. */
  const label = useRef<HTMLDivElement>(null);
  const fstop = useRef<HTMLSpanElement>(null);
  const drive = useRef<GlobeDrive>({ intro: 0, progress: 0, shift: 0, zoom: 0 });
  const now = useNow();

  const stops = useMemo(
    () =>
      allStops.filter((s) => (year === "All" || String(s.year) === year) && (region === "All" || s.region === region)),
    [allStops, year, region],
  );
  const places = useMemo(() => {
    const out: Place[] = [];
    stops.forEach((s, i) => {
      const last = out.at(-1);
      if (last && last.slug === s.slug) last.indices.push(i);
      else out.push({ slug: s.slug, chapter: s.chapter, first: i, indices: [i] });
    });
    return out;
  }, [stops]);

  /** Index (into `stops`) of the city showing for a place. */
  const cityOf = (p: Place, picks: Record<string, string> = chosen) =>
    p.indices.find((i) => stops[i].name === picks[p.slug]) ?? p.first;

  const place = placeIdx >= 0 ? places[Math.min(placeIdx, places.length - 1)] : undefined;
  const active = place ? cityOf(place) : -1;
  const stop = active >= 0 ? stops[active] : undefined;
  const touring = Boolean(stop);

  // The globe fades in as the aperture opens (instantly under reduced motion);
  // it stops rendering while the section is off screen.
  useEffect(() => {
    if (reduced) drive.current.intro = 1;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, [reduced]);

  // Slide aside while touring; zoom in on places with more than one city.
  const multiCity = Boolean(place && place.indices.length > 1);
  useEffect(() => {
    drive.current.shift = touring ? 1 : 0;
    drive.current.zoom = touring && multiCity ? 1 : 0;
  }, [touring, multiCity]);

  useGSAP(
    () => {
      const n = places.length;
      drive.current.progress = reduced ? stops.length - 1 : 0;
      if (reduced || n === 0) return;
      setPlaceIdx(-1);
      setChosen({});

      const held = (k: number) => {
        const p = places[k];
        return p.indices.find((i) => stops[i].name === chosenRef.current[p.slug]) ?? p.first;
      };

      const el = root.current!;
      const aperture = el.querySelector<HTMLElement>("[data-aperture]");
      const setOpen = (open: number) => {
        el.style.setProperty("--open", open.toFixed(4));
        drive.current.intro = smooth(Math.min(open * 1.4, 1));
        if (fstop.current)
          fstop.current.textContent = F_STOPS[Math.min(Math.floor(open * F_STOPS.length), F_STOPS.length - 1)];
        // Once fully open, the contact sheet steps aside so the globe takes clicks.
        if (aperture) aperture.style.visibility = open >= 0.999 ? "hidden" : "visible";
      };
      setOpen(0);
      const units = OPEN_VH + IDLE_VH + Math.max(n, 3) * VH_PER_PLACE;

      const st = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: () => `+=${units * window.innerHeight}`,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const u = self.progress * units;
          // 1. The aperture opens onto the globe.
          setOpen(Math.min(u / OPEN_VH, 1));
          if (u < OPEN_VH + IDLE_VH) {
            drive.current.progress = 0;
            setPlaceIdx(-1);
            return;
          }
          // 2. Each place owns an equal slice of the scroll. The globe holds on
          // it for the first part of the slice, then travels to the next place.
          const x = Math.min((u - OPEN_VH - IDLE_VH) / (Math.max(n, 3) * VH_PER_PLACE * 0.97), 1) * n;
          const seg = Math.min(Math.floor(x), n - 1);
          const t = seg < n - 1 ? smooth(Math.min(Math.max((x - seg - HOLD) / (1 - HOLD), 0), 1)) : 0;
          const from = held(seg);
          const to = seg < n - 1 ? places[seg + 1].first : from;
          drive.current.progress = from + (to - from) * t;
          setPlaceIdx(t > 0.5 ? seg + 1 : seg);
        },
      });
      return () => st.kill();
    },
    { scope: root, dependencies: [places, reduced], revertOnUpdate: true },
  );

  /** Pick a city within the current place: the globe turns and the route draws to it. */
  const chooseCity = (i: number) => {
    const s = stops[i];
    setChosen((c) => ({ ...c, [s.slug]: s.name }));
    gsap.to(drive.current, { progress: i, duration: reduced ? 0 : 0.9, ease: "power2.inOut" });
  };

  /** Jump the readout to any stop (keyboard focus in the full stop list). */
  const focusStop = (i: number) => {
    const k = places.findIndex((p) => p.indices.includes(i));
    if (k >= 0) setPlaceIdx(k);
    chooseCity(i);
  };

  const pick = (i: number) => {
    focusStop(i);
    window.setTimeout(() => router.push(`/chapters/${stops[i].slug}`), reduced ? 0 : 600);
  };

  return (
    <section
      ref={root}
      id="globe"
      aria-label="Around the world"
      className="relative h-[100svh] min-h-[600px] overflow-hidden bg-ink"
      style={{ "--open": reduced ? 1 : 0, "--r": "calc(var(--open) * 78vmax)" } as React.CSSProperties}
    >
      {!reduced && mosaic.length > 0 && <ApertureMosaic frames={mosaic} now={now} fstop={fstop} />}

      <div className="absolute inset-x-0 bottom-[36%] top-[calc(var(--header-h)+64px)] md:inset-0">
        {boot &&
          (lite ? (
            <Globe2D
              stops={stops}
              active={active}
              focus={place?.indices ?? []}
              label={label}
              drive={drive}
              lite
              running={visible}
              onPick={pick}
            />
          ) : (
            <GlobeCanvas
              stops={stops}
              active={active}
              focus={place?.indices ?? []}
              label={label}
              drive={drive}
              lite={false}
              running={visible}
              onPick={pick}
            />
          ))}
        <div
          ref={label}
          aria-hidden
          className="micro pointer-events-none absolute left-0 top-0 z-10 flex items-center gap-2 whitespace-nowrap text-paper opacity-0 transition-opacity duration-300 will-change-transform"
        >
          <span className="h-px w-5 bg-paper/60" />
          {stop?.name}
        </div>
      </div>

      <div className="gutter pointer-events-none relative z-10 flex h-full flex-col justify-end pb-[clamp(24px,5vh,56px)] pt-[var(--header-h)]">
        {/* Top right: every stop (for keyboard and screen-reader users, and anyone who
            wants to jump), plus the filters while the tour runs. */}
        <div className="pointer-events-auto absolute right-[var(--gutter)] top-[calc(var(--header-h)+12px)] flex flex-col items-end gap-3">
          <button
            type="button"
            aria-expanded={listOpen}
            aria-controls="stop-list"
            onClick={() => setListOpen((o) => !o)}
            className="micro text-paper-dim transition-colors hover:text-paper"
          >
            {listOpen ? "Close" : `All stops [${stops.length}]`}
          </button>
          {listOpen && (
            <ol
              id="stop-list"
              aria-label="Stops in travel order"
              className="hud grid max-h-[50vh] grid-cols-1 gap-y-1 overflow-auto bg-ink py-2 pl-4 text-right sm:grid-cols-2 sm:gap-x-6"
            >
              {stops.map((s, i) => (
                <li key={`${s.slug}-${s.name}`}>
                  <button
                    type="button"
                    onClick={() => pick(i)}
                    onFocus={() => focusStop(i)}
                    aria-current={i === active ? "location" : undefined}
                    className="text-paper-dim transition-colors hover:text-paper aria-[current=location]:text-paper"
                  >
                    {s.name} <span className="text-paper-faint">{pad(s.seq + 1, 2)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div
            className="flex flex-col items-end gap-1.5 transition-opacity duration-500"
            style={{ opacity: touring && !listOpen ? 1 : 0, visibility: touring && !listOpen ? "visible" : "hidden" }}
          >
            <Filter label="Filter by year" options={YEARS} value={year} onChange={setYear} />
            <Filter label="Filter by region" options={REGIONS} value={region} onChange={setRegion} />
          </div>
        </div>

        <div className="relative grid items-end">
          {/* A beat on the whole globe once the aperture is open, before the tour.
              The outer wrapper waits for the aperture to finish opening. */}
          <div className="col-start-1 row-start-1" style={{ opacity: "clamp(0, (var(--open, 1) - 0.82) * 6, 1)" }}>
            <div
              className="transition-[opacity,transform] duration-700 ease-[var(--ease-out)]"
              style={{ opacity: touring ? 0 : 1, transform: touring ? "translateY(-16px)" : "none" }}
              aria-hidden={touring}
            >
              {reduced ? (
                <h1 className="display text-[clamp(52px,9.4vw,168px)]">
                  Brooks
                  <br />
                  Barrett
                </h1>
              ) : (
                <>
                  <p className="micro text-paper-faint">Around the world</p>
                  <p className="display mt-3 text-[clamp(36px,5vw,80px)]">
                    {places.length} places
                    <br />
                    {stops.length} cities
                  </p>
                </>
              )}
              <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                <p className="max-w-[34ch] text-paper-dim">
                  {reduced ? site.description : "2024 — 2026, in the order they happened. Keep scrolling to travel."}
                </p>
              </div>
            </div>
          </div>

          {/* Tour readout */}
          <div
            className="pointer-events-auto col-start-1 row-start-1 transition-opacity duration-500"
            style={{ opacity: touring ? 1 : 0, visibility: touring ? "visible" : "hidden" }}
          >
            {stop && place && (
              <div aria-live="polite">
                <p className="micro text-paper-faint">
                  Around the world — {pad(placeIdx + 1, 2)} / {pad(places.length, 2)}
                </p>
                <p
                  className={`display mt-3 ${stop.chapter.length > 14 ? "text-[clamp(30px,3.6vw,56px)]" : "text-[clamp(36px,5vw,80px)]"}`}
                >
                  {stop.chapter}
                </p>
                <p className="hud mt-3 text-paper-dim" suppressHydrationWarning>
                  <span className="text-paper">{stop.name}</span>
                  <span className="mx-2 text-paper-faint">·</span>
                  {formatLat(stop.lat, 2)} {formatLng(stop.lng, 2)}
                  <span className="mx-2 text-paper-faint">·</span>
                  {now ? `${clock(stop.tz, now)} ${tzLabel(stop.tz, now).split(" ")[0]}` : "--:--"}
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
                          onClick={() => chooseCity(i)}
                          className="group block w-full text-left"
                        >
                          <span
                            className={`relative block aspect-[4/5] overflow-hidden bg-ink-2 transition-opacity duration-300 ${on ? "opacity-100" : "opacity-45 group-hover:opacity-80"}`}
                          >
                            {photo && <FrameImage frame={photo} sizes="100px" bare />}
                          </span>
                          <span
                            className={`mt-1.5 block h-px transition-colors ${on ? "bg-signal" : "bg-transparent"}`}
                          />
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
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
