"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Frame, TravelStop } from "@/lib/frames";
import { formatLat, formatLng, pad } from "@/lib/format";
import { site } from "@/lib/site";
import { clock, tzLabel } from "@/lib/time";
import type { Region } from "@/lib/types";
import { FrameImage } from "../FrameImage";
import { Hud } from "../Hud";
import { useMediaQuery, usePrefersReducedMotion } from "../motion/useReducedMotion";
import type { GlobeDrive } from "./geo3d";

gsap.registerPlugin(ScrollTrigger);

// Desktop gets the WebGL globe; phones get a 2D-canvas projection and never load three.js.
const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false });
const Globe2D = dynamic(() => import("./Globe2D"), { ssr: false });

const YEARS = ["All", "2024", "2025", "2026"] as const;
const REGIONS: ("All" | Region)[] = ["All", "North America", "Caribbean", "Europe", "Asia"];
/** Scroll distance per stop, in viewport heights. */
const VH_PER_STOP = 0.4;
/** Share of the pinned scroll spent on the intro before the tour starts. */
const INTRO = 0.08;

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
 * The opening. The globe is the hero: it idles under the name, and scrolling
 * pins the section and walks it through every stop in travel order, drawing
 * the route as it goes. A live readout reports where, and what time it is there.
 */
export function GlobeSection({ stops: allStops, covers }: { stops: TravelStop[]; covers: Record<string, Frame> }) {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const lite = useMediaQuery("(max-width: 767px), (pointer: coarse)");
  const [year, setYear] = useState<(typeof YEARS)[number]>("All");
  const [region, setRegion] = useState<"All" | Region>("All");
  const [active, setActive] = useState(-1);
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
  const drive = useRef<GlobeDrive>({ intro: 0, progress: 0, shift: 0 });
  const now = useNow();

  const stops = useMemo(
    () =>
      allStops.filter((s) => (year === "All" || String(s.year) === year) && (region === "All" || s.region === region)),
    [allStops, year, region],
  );
  const stop = active >= 0 ? stops[Math.min(active, stops.length - 1)] : undefined;
  const touring = Boolean(stop);
  const cover = stop ? covers[stop.slug] : undefined;

  // Fade the globe in on load; stop rendering while off screen.
  useEffect(() => {
    const d = drive.current;
    const fade = gsap.to(d, { intro: 1, duration: reduced ? 0 : 1.6, ease: "power2.out", delay: 0.2 });
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    if (root.current) io.observe(root.current);
    return () => {
      fade.kill();
      io.disconnect();
    };
  }, [reduced]);

  useEffect(() => {
    drive.current.shift = touring ? 1 : 0;
  }, [touring]);

  useGSAP(
    () => {
      const n = stops.length;
      drive.current.progress = reduced ? n - 1 : 0;
      if (reduced || n === 0) return;
      setActive(-1);

      const st = ScrollTrigger.create({
        trigger: root.current,
        start: "top top",
        end: () => `+=${Math.max(n, 3) * VH_PER_STOP * window.innerHeight}`,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;
          if (p < INTRO) {
            drive.current.progress = 0;
            setActive(-1);
            return;
          }
          const route = Math.min((p - INTRO) / (0.96 - INTRO), 1) * (n - 1);
          drive.current.progress = route;
          setActive(Math.round(route));
        },
      });
      return () => st.kill();
    },
    { scope: root, dependencies: [stops, reduced], revertOnUpdate: true },
  );

  const pick = (i: number) => {
    setActive(i);
    window.setTimeout(() => router.push(`/chapters/${stops[i].slug}`), reduced ? 0 : 600);
  };

  return (
    <section
      ref={root}
      id="globe"
      aria-label="Around the world"
      className="relative h-[100svh] min-h-[600px] overflow-hidden bg-ink"
    >
      <div className="absolute inset-x-0 bottom-[36%] top-[calc(var(--header-h)+64px)] md:inset-0">
        {boot &&
          (lite ? (
            <Globe2D stops={stops} active={active} drive={drive} lite running={visible} onPick={pick} />
          ) : (
            <GlobeCanvas stops={stops} active={active} drive={drive} lite={false} running={visible} onPick={pick} />
          ))}
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
                    onFocus={() => setActive(i)}
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
          {/* Intro */}
          <div
            className="col-start-1 row-start-1 transition-[opacity,transform] duration-700 ease-[var(--ease-out)]"
            style={{ opacity: touring ? 0 : 1, transform: touring ? "translateY(-16px)" : "none" }}
            aria-hidden={touring}
          >
            <h1 className="display text-[clamp(52px,9.4vw,168px)]">
              Brooks
              <br />
              Barrett
            </h1>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-4 ">
              <p className="max-w-[34ch] text-paper-dim">{site.description}</p>
              <p className="hud flex gap-6 text-paper-dim">
                {site.clocks.map((c) => (
                  <span key={c.label}>
                    {c.label} <span className="text-paper">{now ? clock(c.tz, now) : "--:--"}</span>
                  </span>
                ))}
              </p>
            </div>
          </div>

          {/* Tour readout */}
          <div
            className="pointer-events-auto col-start-1 row-start-1 transition-opacity duration-500"
            style={{ opacity: touring ? 1 : 0, visibility: touring ? "visible" : "hidden" }}
          >
            {stop && (
              <div aria-live="polite" className="flex items-end gap-6">
                {cover && (
                  <div className="relative hidden aspect-[4/5] w-[180px] overflow-hidden lg:block">
                    <FrameImage frame={cover} sizes="180px" />
                    <Hud frame={cover} compact />
                  </div>
                )}
                <div>
                  <p className="micro text-paper-faint">
                    Around the world — {pad(stop.seq + 1, 2)} / {pad(allStops.length, 2)}
                  </p>
                  <p className="display mt-3 text-[clamp(36px,5vw,80px)]">{stop.name}</p>
                  <p className="mt-2 text-paper-dim">{stop.chapter}</p>
                  <dl className="hud mt-5 grid grid-cols-[auto_1fr] gap-x-8 gap-y-1 text-paper-dim">
                    <dt className="text-paper-faint">Lat</dt>
                    <dd>{formatLat(stop.lat)}</dd>
                    <dt className="text-paper-faint">Lon</dt>
                    <dd>{formatLng(stop.lng)}</dd>
                    <dt className="text-paper-faint">Local time</dt>
                    <dd suppressHydrationWarning>{now ? clock(stop.tz, now, true) : "--:--:--"}</dd>
                    <dt className="text-paper-faint">Time zone</dt>
                    <dd suppressHydrationWarning>{now ? tzLabel(stop.tz, now) : "—"}</dd>
                    <dt className="text-paper-faint">Frames</dt>
                    <dd>[{stop.frames}]</dd>
                  </dl>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
