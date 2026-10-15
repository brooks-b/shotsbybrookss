"use client";

import { useEffect, useRef } from "react";
import type { Frame } from "@/lib/frames";
import { pad } from "@/lib/format";
import { FrameImage } from "./FrameImage";
import { Hud } from "./Hud";
import { useLenis } from "./motion/SmoothScroll";

type Props = {
  frames: Frame[];
  index: number | null;
  onIndex: (i: number | null) => void;
  /** Label for the counter, e.g. the chapter title. */
  title?: string;
};

/**
 * Full-screen viewer on a native <dialog>: the browser handles focus
 * trapping, Escape and the inert background. Arrow keys and horizontal
 * swipes step through frames.
 */
export function Lightbox({ frames, index, onIndex, title }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const lenis = useLenis();
  const open = index !== null;
  const frame = open ? frames[index] : null;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      lenis?.stop();
    } else if (!open && d.open) {
      d.close();
    }
    return () => {
      if (!open) lenis?.start();
    };
  }, [open, lenis]);

  const step = (dir: 1 | -1) => {
    if (index === null) return;
    onIndex((index + dir + frames.length) % frames.length);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-label={frame ? `${frame.collectionTitle}, frame ${frame.index} of ${frame.total}` : "Photo viewer"}
      onClose={() => {
        lenis?.start();
        onIndex(null);
      }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const s = swipe.current;
        swipe.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y)) step(dx < 0 ? 1 : -1);
      }}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none bg-ink p-0 text-paper backdrop:bg-ink/95 open:flex open:flex-col"
    >
      {frame && (
        <>
          <div className="gutter hud flex h-[var(--header-h)] shrink-0 items-center justify-between text-[11px]">
            <span className="flex items-center gap-2">
              {title ?? frame.collectionTitle}
              {frame.stop && <span className="text-paper-dim">— {frame.stop}</span>}
            </span>
            <button
              type="button"
              onClick={() => onIndex(null)}
              className="micro -mr-2 p-2 text-paper-dim hover:text-paper"
              autoFocus
            >
              Close
            </button>
          </div>

          <div className="relative min-h-0 flex-1 px-[var(--gutter)] pb-4">
            {/* Sized to the frame's aspect ratio so the HUD sits on the photo, not the screen. */}
            <div
              className="relative mx-auto h-full max-w-full"
              style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
            >
              <FrameImage key={frame.key} frame={frame} sizes="100vw" priority />
              <Hud frame={frame} />
            </div>
          </div>

          <div className="gutter hud flex h-14 shrink-0 items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => step(-1)}
              className="p-2 text-paper-dim hover:text-paper"
              aria-label="Previous frame"
            >
              ← Prev
            </button>
            <span className="text-paper-dim">
              {pad(index! + 1)} / {pad(frames.length)}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              className="p-2 text-paper-dim hover:text-paper"
              aria-label="Next frame"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
