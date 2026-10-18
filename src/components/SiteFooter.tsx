import Link from "next/link";
import { getChapters } from "@/lib/content";
import { site } from "@/lib/site";
import { Clock } from "./Clock";

function Col({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="micro mb-5 text-paper-faint">[{label}]</p>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  );
}

const linkCls = "text-paper-dim transition-colors hover:text-paper";

export function SiteFooter() {
  const chapters = [...getChapters()].reverse();

  return (
    <footer className="gutter mt-24 border-t border-line pb-8 pt-16">
      <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-12">
        <div className="col-span-2 md:col-span-4">
          <Link href="/" className="display text-[clamp(28px,3vw,40px)]">
            Brooks Barrett
          </Link>
        </div>
        <div className="md:col-span-2 md:col-start-6">
          <Col label="work">
            {chapters.map((c) => (
              <li key={c.slug}>
                <Link href={`/chapters/${c.slug}`} className={linkCls}>
                  {c.title}
                </Link>
              </li>
            ))}
          </Col>
        </div>
        <div className="md:col-span-2">
          <Col label="about">
            <li>
              <Link href="/about" className={linkCls}>
                About
              </Link>
            </li>
            <li>
              <Link href="/archive" className={linkCls}>
                Archive
              </Link>
            </li>
          </Col>
        </div>
        <div className="md:col-span-2">
          <Col label="build">
            <li>
              <Link href="/colophon" className={linkCls}>
                Colophon
              </Link>
            </li>
            <li>
              <a href={site.github} className={linkCls} target="_blank" rel="noreferrer">
                GitHub
              </a>
            </li>
          </Col>
        </div>
        <div className="md:col-span-2">
          <Col label="follow">
            <li>
              <a href={site.instagram} className={linkCls} target="_blank" rel="noreferrer">
                Instagram @{site.handle}
              </a>
            </li>
            {site.email && (
              <li>
                <a href={`mailto:${site.email}`} className={`${linkCls} break-all`}>
                  {site.email}
                </a>
              </li>
            )}
          </Col>
        </div>
      </div>

      <div className="hud mt-20 flex flex-wrap justify-between gap-x-6 gap-y-2 text-paper-faint">
        <span>
          © {new Date().getFullYear()} {site.name}
        </span>
        <span className="flex gap-6">
          {site.clocks.map((c) => (
            <span key={c.label}>
              {c.label} <Clock tz={c.tz} />
            </span>
          ))}
        </span>
      </div>
    </footer>
  );
}
