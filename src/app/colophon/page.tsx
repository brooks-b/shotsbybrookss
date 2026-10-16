import type { Metadata } from "next";
import { PipelineDiagram } from "@/components/colophon/PipelineDiagram";
import { formatBytes } from "@/lib/format";
import { site } from "@/lib/site";
import { snippet } from "@/lib/snippets";
import { getBuildStats } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Colophon",
  description: "How this site is built: the stack, the image pipeline, and numbers from the latest build.",
  alternates: { canonical: "/colophon" },
};

const STACK = [
  ["Next.js 16 + TypeScript", "Every page is prerendered at build time. No server needed to serve the site."],
  ["Tailwind CSS 4", "Design tokens live in CSS variables; utilities keep components readable."],
  [
    "Three.js + React Three Fiber",
    "The globe: one draw call of point sprites with custom shaders, plus arcs and pins.",
  ],
  ["Lenis", "Smooth scrolling that only runs while you're scrolling, so an idle page does no per-frame work."],
  ["sharp + exifr", "Resizes and encodes images, and reads EXIF. A small custom parser reads Fuji maker notes."],
  ["Vercel Blob", "Stores image derivatives outside the repo, served with immutable caching."],
  ["Vitest + GitHub Actions", "Tests the pipeline; lint, typecheck, tests and build run on every push."],
];

const CREDITS = [
  ["Inter Tight", "Rasmus Andersson, SIL Open Font License"],
  ["Geist, Geist Mono", "Vercel, SIL Open Font License"],
  ["Land data", "Natural Earth (public domain) via world-atlas"],
  [
    "Libraries",
    "Next.js, React, three.js, React Three Fiber, GSAP, Lenis, sharp, exifr, thumbhash, Shiki, Tailwind CSS",
  ],
];

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-8 border-t border-line py-16 md:grid-cols-12">
      <h2 className="micro text-paper-faint md:col-span-3">{label}</h2>
      <div className="min-w-0 md:col-span-9">{children}</div>
    </section>
  );
}

export default async function ColophonPage() {
  const stats = getBuildStats();
  const lh = stats.lighthouse;
  const numbers: [string, string][] = [
    ["Photos published", String(stats.photos)],
    ["Frames, incl. placeholders", String(stats.frames)],
    ["Image derivatives", String(stats.derivatives)],
    ["Bytes saved by pipeline", formatBytes(stats.bytesSaved)],
    ["Build time", stats.buildSeconds ? `${stats.buildSeconds.toFixed(1)} s` : "—"],
    ["Pages prerendered", stats.routes ? String(stats.routes) : "—"],
    ["Lighthouse performance", lh ? String(lh.performance) : "—"],
    ["Lighthouse accessibility", lh ? String(lh.accessibility) : "—"],
    ["Lighthouse best practices", lh ? String(lh.bestPractices) : "—"],
    ["Lighthouse SEO", lh ? String(lh.seo) : "—"],
  ];

  const snippets = await Promise.all([
    snippet("src/lib/exif/fuji.ts", "export function parseFilmSim"),
    snippet("src/components/globe/geo3d.ts", "export function rotationToFace"),
    snippet("src/components/globe/shaders.ts", "export const arcFragment"),
  ]);
  const captions = [
    "Reads the film simulation from Fujifilm's maker note.",
    "Finds the rotation that turns any city to face the camera.",
    "Draws each travel arc with a single uniform.",
  ];

  return (
    <div className="gutter pb-12 pt-[calc(var(--header-h)+48px)]">
      <h1 className="display text-[clamp(52px,9vw,160px)]">Colophon</h1>
      <p className="mt-8 max-w-[52ch] text-[17px] text-paper-dim">
        I designed and built this site myself. The code is public on{" "}
        <a
          href={site.github}
          target="_blank"
          rel="noreferrer"
          className="text-paper underline decoration-line-strong underline-offset-4 hover:decoration-paper"
        >
          GitHub
        </a>
        .
      </p>

      <div className="mt-20">
        <Section label="Numbers">
          <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-5">
            {numbers.map(([k, v]) => (
              <div key={k} className="border-t border-line py-4">
                <dt className="text-[13px] text-paper-dim">{k}</dt>
                <dd className="hud mt-2 text-[22px] text-paper">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="hud mt-6 text-paper-faint">
            Generated from content/manifest.json and src/data/build-stats.json
            {stats.statsGeneratedAt ? `, last measured ${stats.statsGeneratedAt.slice(0, 10)}` : ""}.
          </p>
        </Section>

        <Section label="Stack">
          <dl>
            {STACK.map(([k, v]) => (
              <div
                key={k}
                className="grid gap-1 border-t border-line py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6"
              >
                <dt className="text-paper">{k}</dt>
                <dd className="text-paper-dim">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section label="Image pipeline">
          <PipelineDiagram />
        </Section>

        <Section label="Code">
          <div className="flex flex-col gap-12">
            {snippets.map((s, i) => (
              <figure key={s.file}>
                <figcaption className="mb-3 flex flex-wrap justify-between gap-2">
                  <span className="text-paper">{captions[i]}</span>
                  <a
                    href={`${site.github}/blob/main/${s.file}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hud text-paper-faint hover:text-paper"
                  >
                    {s.file}
                  </a>
                </figcaption>
                <div
                  className="overflow-x-auto bg-ink-2 p-5 text-[12.5px] leading-[1.6] [&_pre]:!bg-transparent"
                  dangerouslySetInnerHTML={{ __html: s.html }}
                />
              </figure>
            ))}
          </div>
        </Section>

        <Section label="Credits">
          <dl>
            {CREDITS.map(([k, v]) => (
              <div
                key={k}
                className="grid gap-1 border-t border-line py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6"
              >
                <dt className="text-paper">{k}</dt>
                <dd className="text-paper-dim">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </div>
  );
}
