import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "Brooks Barrett: Vanderbilt '29, based between Nashville and the New York area.",
  alternates: { canonical: "/about" },
};

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-6 border-t border-line py-3">
      <dt className="text-paper-dim">{k}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="gutter grid gap-16 pb-12 pt-[calc(var(--header-h)+48px)] md:grid-cols-12">
      <div className="md:col-span-5">
        <picture className="block aspect-[4/5] w-full overflow-hidden bg-ink-2">
          {(["avif", "webp"] as const).map((type) => (
            <source
              key={type}
              type={`image/${type}`}
              srcSet={[480, 800, 1200].map((w) => `/about/portrait-${w}.${type} ${w}w`).join(", ")}
              sizes="(min-width: 768px) 40vw, 100vw"
            />
          ))}
          <img
            src="/about/portrait-800.webp"
            alt="Brooks Barrett"
            width={800}
            height={1200}
            fetchPriority="high"
            className="h-full w-full object-cover object-top"
          />
        </picture>
      </div>

      <div className="md:col-span-6 md:col-start-7">
        <h1 className="display text-[clamp(52px,7vw,120px)]">About</h1>
        <div className="mt-10 flex max-w-[52ch] flex-col gap-4 text-[17px] text-paper-dim">
          {site.bio.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <h2 className="micro mb-4 mt-16 text-paper-faint">Kit</h2>
        <dl>
          <Row k="Camera">{site.camera}</Row>
          {site.lenses.length > 0 ? (
            site.lenses.map((l, i) => (
              <Row key={l} k={`Lens ${i + 1}`}>
                {l}
              </Row>
            ))
          ) : (
            <Row k="Lenses">
              <span className="text-paper-faint">To be added</span>
            </Row>
          )}
        </dl>

        <h2 className="micro mb-4 mt-16 text-paper-faint">Contact</h2>
        <dl>
          <Row k="Instagram">
            <a href={site.instagram} target="_blank" rel="noreferrer" className="hover:text-signal">
              @{site.handle}
            </a>
          </Row>
          {site.email && (
            <Row k="Email">
              <a href={`mailto:${site.email}`} className="hover:text-signal">
                {site.email}
              </a>
            </Row>
          )}
        </dl>
      </div>
    </div>
  );
}
