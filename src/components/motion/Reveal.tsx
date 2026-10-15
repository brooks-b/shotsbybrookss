"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  as?: "div" | "figure" | "section" | "p" | "h2" | "span";
  /** "fade" fades photos in quickly; "lines" slides text lines up. */
  variant?: "fade" | "lines";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  /** Fraction of the element that must be visible. */
  threshold?: number;
};

/** Sets data-open="true" the first time the element scrolls into view. CSS does the rest. */
export function Reveal({ as = "div", variant = "fade", className = "", style, children, threshold }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOpen(true);
          io.disconnect();
        }
      },
      // Photos start fading a little before they arrive; text waits until it's in view.
      variant === "fade"
        ? { threshold: threshold ?? 0, rootMargin: "0px 0px 15% 0px" }
        : { threshold: threshold ?? 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, variant]);

  const Tag = as as "div";
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      data-open={open}
      className={`${variant === "fade" ? "fade-in" : ""} ${className}`}
      style={style}
    >
      {children}
    </Tag>
  );
}

/** Splits text lines into masked spans for the "lines" reveal. */
export function Lines({ lines, className = "" }: { lines: readonly string[]; className?: string }) {
  return (
    <>
      {lines.map((line, i) => (
        <span key={i} className={`line-mask ${className}`}>
          <span style={{ "--i": i } as React.CSSProperties}>{line}</span>
        </span>
      ))}
    </>
  );
}
