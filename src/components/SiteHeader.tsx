"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import { Clock } from "./Clock";

type Props = { chapters: number; frames: number };

export function SiteHeader({ chapters, frames }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the phone menu on navigation and on Escape.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting UI on route change
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const links = [
    { href: "/#chapters", label: "Work", count: chapters },
    { href: "/archive", label: "Archive", count: frames },
    { href: "/colophon", label: "Colophon" },
    { href: "/about", label: "About" },
  ];
  const isActive = (href: string) => href !== "/#chapters" && pathname.startsWith(href);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${scrolled ? "bg-ink" : "bg-transparent"}`}
    >
      <div className="gutter relative flex h-[var(--header-h)] items-center justify-between gap-6">
        <Link href="/" className="micro flex items-center gap-2.5 text-paper" aria-label={`${site.name}, home`}>
          <span className="rec-dot" aria-hidden />
          {site.handle}
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="micro flex items-center gap-6">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className="text-paper-dim transition-colors hover:text-paper aria-[current=page]:text-paper"
                >
                  {l.label}
                  {l.count !== undefined && <span className="ml-1 text-paper-faint">[{l.count}]</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          className="micro relative z-10 -mr-2 p-2 text-paper md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "[ Close ]" : "[ Menu ]"}
        </button>
      </div>

      <div
        id="mobile-menu"
        hidden={!open}
        className="gutter fixed inset-0 z-0 flex flex-col justify-between bg-ink pb-8 pt-[calc(var(--header-h)+24px)] md:hidden"
      >
        <ul className="flex flex-col gap-1">
          {links.map((l, i) => (
            <li key={l.href} className="border-b border-line">
              <Link href={l.href} className="flex items-baseline justify-between py-3" onClick={() => setOpen(false)}>
                <span className="display text-[11vw]">{l.label}</span>
                <span className="hud text-paper-dim">{l.count !== undefined ? `[${l.count}]` : `0${i + 1}`}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="hud flex justify-between text-paper-dim">
          {site.clocks.map((c) => (
            <span key={c.label}>
              {c.label} <Clock tz={c.tz} />
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
