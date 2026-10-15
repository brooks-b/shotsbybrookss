"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState } from "react";
import type { Frame, PlaceInfo } from "@/lib/frames";
import { FrameImage } from "../FrameImage";
import { ApertureMosaic, F_STOPS } from "../globe/ApertureMosaic";
import { ATMOSPHERES } from "../globe/atmospheres";
import { useMediaQuery, usePrefersReducedMotion } from "../motion/useReducedMotion";
import { visitPlace } from "./visit";

gsap.registerPlugin(ScrollTrigger);

/** Scroll spent opening the aperture from the contact sheet onto the board. */
const OPEN_VH = 1.1;
/** A short hold on the open board before the page scrolls on. */
const HOLD_VH = 0.3;

const smooth = (t: number) => t * t * (3 - 2 * t);

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts client-side
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * The board sits under the contact sheet until you scroll, so its photos wait
 * for your first interaction. (Loading them earlier would make a hidden photo
 * count as the page's main content, long after the name has painted.)
 */
function useAfterInteraction(skip: boolean) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (skip) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing covers the board
      setReady(true);
      return;
    }
    const events = ["scroll", "wheel", "touchstart", "pointerdown", "keydown"] as const;
    const go = () => {
      setReady(true);
      events.forEach((e) => window.removeEventListener(e, go));
    };
    events.forEach((e) => window.addEventListener(e, go, { passive: true, once: true }));
    return () => events.forEach((e) => window.removeEventListener(e, go));
  }, [skip]);
  return ready;
}

/**
 * The opening: a contact sheet of photos that irises open onto a board of
 * destinations, one tall photo panel per place. Hover (or tap) widens a
 * panel and the page takes on that place's colour; click to arrive there.
 */
export function Opening({ places, mosaic }: { places: PlaceInfo[]; mosaic: Frame[] }) {
  const reduced = usePrefersReducedMotion();
  const stacked = useMediaQuery("(max-width: 767px)");
  const root = useRef<HTMLElement>(null);
  const fstop = useRef<HTMLSpanElement>(null);
  const now = useNow();
  const loaded = useAfterInteraction(reduced);
  const lead = Math.max(
    places.findIndex((p) => p.slug === "japan"),
    0,
  );
  const [active, setActive] = useState(lead);
  const tone = ATMOSPHERES[places[active]?.slug]?.tone;

  useGSAP(
    () => {
      if (reduced) return;
      const el = root.current!;
      const aperture = el.querySelector<HTMLElement>("[data-aperture]");
      const setOpen = (open: number) => {
        el.style.setProperty("--open", smooth(open).toFixed(4));
        if (fstop.current)
          fstop.current.textContent = F_STOPS[Math.min(Math.floor(open * F_STOPS.length), F_STOPS.length - 1)];
        // Once open, the contact sheet steps aside so the board takes clicks.
        if (aperture) aperture.style.visibility = open >= 0.999 ? "hidden" : "visible";
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

  const onPanel = (i: number, el: HTMLElement) => {
    // Phones: the first tap opens the strip, the second goes there.
    if (stacked && i !== active) {
      setActive(i);
      return;
    }
    visitPlace(places[i].slug, el);
  };

  return (
    <section
      ref={root}
      aria-label="Where do you want to go?"
      data-tone={tone}
      className="relative h-[100svh] min-h-[600px] overflow-hidden bg-ink"
      style={{ "--open": reduced ? 1 : 0, "--r": "calc(var(--open) * 78vmax)" } as React.CSSProperties}
    >
      {!reduced && mosaic.length > 0 && <ApertureMosaic frames={mosaic} now={now} fstop={fstop} />}

      <div className="gutter flex h-full flex-col pb-[clamp(16px,3vh,32px)] pt-[calc(var(--header-h)+8px)]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          {reduced && <h1 className="sr-only">Brooks Barrett</h1>}
          <h2 className="display text-balance text-[clamp(28px,3.4vw,56px)]">Where do you want to go?</h2>
          <p className="micro text-paper-dim">
            {places.length} places · {places.reduce((n, p) => n + p.cities.length, 0)} cities · 2024 — 2026
          </p>
        </div>

        {/* The board: a strip of photo panels, one per place, in travel order. */}
        <ul className="flex min-h-0 flex-1 flex-col gap-[3px] md:flex-row">
          {places.map((p, i) => {
            const on = i === active;
            return (
              <li
                key={p.slug}
                className="relative min-h-0 min-w-0 overflow-hidden transition-[flex-grow] duration-700 ease-[var(--ease-out)] motion-reduce:transition-none"
                style={{ flexGrow: on ? (stacked ? 5 : 7) : 1, flexBasis: 0 }}
              >
                <button
                  type="button"
                  onClick={(e) => onPanel(i, e.currentTarget)}
                  onPointerEnter={() => !stacked && setActive(i)}
                  onFocus={() => setActive(i)}
                  aria-label={`${p.title}, ${p.year}. ${p.cities.length} ${p.cities.length === 1 ? "city" : "cities"}.`}
                  className="group absolute inset-0 block text-left"
                >
                  <span
                    className={`absolute inset-0 transition-[filter,transform] duration-700 ease-[var(--ease-out)] ${on ? "brightness-[0.8]" : "brightness-[0.45] group-hover:brightness-[0.6]"}`}
                    style={{ background: p.cover ? undefined : ATMOSPHERES[p.slug]?.tone }}
                  >
                    {p.cover && (
                      <span className="absolute inset-0 block transition-transform duration-[1200ms] ease-[var(--ease-out)] group-hover:scale-[1.03]">
                        <FrameImage frame={p.cover} sizes={stacked ? "100vw" : "50vw"} bare deferred={!loaded} />
                      </span>
                    )}
                  </span>

                  {/* Collapsed: the name runs up the strip. Open: it sits across the bottom. */}
                  <span
                    className={`absolute inset-x-0 bottom-0 p-3 transition-opacity duration-300 md:p-4 ${on ? "opacity-0" : "opacity-100"}`}
                  >
                    <span className="micro block text-paper/90 md:origin-bottom-left md:-rotate-90 md:translate-x-4 md:whitespace-nowrap">
                      {p.title}
                    </span>
                  </span>
                  <span
                    className={`absolute inset-x-0 bottom-0 p-4 transition-[opacity,transform] duration-500 ease-[var(--ease-out)] md:p-6 ${on ? "translate-y-0 opacity-100 delay-200" : "pointer-events-none translate-y-3 opacity-0"}`}
                  >
                    <span className="micro block text-paper/80">
                      {p.year}
                      {p.cities.length > 1 ? ` · ${p.cities.length} cities` : ""}
                    </span>
                    <span className="display mt-2 block whitespace-nowrap text-[clamp(30px,4.2vw,72px)]">
                      {p.title}
                    </span>
                    <span className="micro mt-3 inline-block border-b border-paper/50 pb-0.5 text-paper">
                      {stacked ? "Tap to go →" : "Go →"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
