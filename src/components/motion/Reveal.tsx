"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  as?: "div" | "figure" | "section" | "p" | "h2" | "span";
  /** "shutter" opens like a focal-plane shutter; "lines" slides text lines up. */
  variant?: "shutter" | "lines";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  /** Fraction of the element that must be visible. */
  threshold?: number;
};

/** Sets data-open="true" the first time the element scrolls into view. CSS does the rest. */
export function Reveal({ as = "div", variant = "shutter", className = "", style, children, threshold = 0.15 }: Props) {
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
      { threshold, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  const Tag = as as "div";
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      data-open={open}
      className={`${variant === "shutter" ? "shutter" : ""} ${className}`}
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
